# Lee el texto de una imagen o de un PDF con el reconocedor de texto que trae Windows (Windows.Media.Ocr).
# Todo ocurre en el equipo: no se descarga ni se envía nada. Lo usa desktop/importer.js.
# Salida (JSON en UTF-8): { lang, pages: [ { width, lines: [ { y, words: [ { t, x, y, w, h } ] } ] } ] }
# Windows agrupa las palabras por bloques (en una tabla, a menudo por columnas): importer.js rehace
# las filas con la posición de cada palabra.
param(
  [Parameter(Mandatory = $true)][string]$Path,
  [string]$Lang = '',
  [int]$MaxPages = 10
)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
$null = [Windows.Storage.Streams.InMemoryRandomAccessStream, Windows.Storage.Streams, ContentType = WindowsRuntime]
$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics, ContentType = WindowsRuntime]
$null = [Windows.Data.Pdf.PdfDocument, Windows.Data.Pdf, ContentType = WindowsRuntime]
$null = [Windows.Globalization.Language, Windows.Globalization, ContentType = WindowsRuntime]

$ext = [System.WindowsRuntimeSystemExtensions].GetMethods()
$asTaskOp = ($ext | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
$asTaskAction = ($ext | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncAction' })[0]
function Await($op, [Type]$type) {
  $task = $asTaskOp.MakeGenericMethod($type).Invoke($null, @($op))
  $null = $task.Wait(-1)
  $task.Result
}
function AwaitAction($action) {
  $task = $asTaskAction.Invoke($null, @($action))
  $null = $task.Wait(-1)
}

# Idioma: el de la app si Windows lo tiene instalado; si no, los del perfil del usuario.
$engine = $null
if ($Lang) {
  try {
    $l = New-Object Windows.Globalization.Language($Lang)
    if ([Windows.Media.Ocr.OcrEngine]::IsLanguageSupported($l)) { $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($l) }
  } catch {}
}
if (-not $engine) { $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages() }
if (-not $engine) { throw 'no_ocr_language' }
$max = [Windows.Media.Ocr.OcrEngine]::MaxImageDimension

function Read-Bitmap($stream) {
  $decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
  $w = $decoder.PixelWidth; $h = $decoder.PixelHeight
  $scale = [Math]::Min(1.0, $max / [double][Math]::Max($w, $h))
  $transform = New-Object Windows.Graphics.Imaging.BitmapTransform
  if ($scale -lt 1.0) {
    $transform.ScaledWidth = [uint32][Math]::Floor($w * $scale)
    $transform.ScaledHeight = [uint32][Math]::Floor($h * $scale)
  }
  Await ($decoder.GetSoftwareBitmapAsync(
      [Windows.Graphics.Imaging.BitmapPixelFormat]::Bgra8,
      [Windows.Graphics.Imaging.BitmapAlphaMode]::Premultiplied,
      $transform,
      [Windows.Graphics.Imaging.ExifOrientationMode]::RespectExifOrientation,
      [Windows.Graphics.Imaging.ColorManagementMode]::DoNotColorManage)) ([Windows.Graphics.Imaging.SoftwareBitmap])
}

function Read-Page($bitmap) {
  $result = Await ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
  $lines = @()
  foreach ($line in $result.Lines) {
    $words = @()
    $top = [double]::MaxValue
    foreach ($word in $line.Words) {
      $r = $word.BoundingRect
      if ($r.Y -lt $top) { $top = $r.Y }
      $words += [ordered]@{ t = $word.Text; x = [Math]::Round($r.X); y = [Math]::Round($r.Y); w = [Math]::Round($r.Width); h = [Math]::Round($r.Height) }
    }
    $lines += [ordered]@{ y = [Math]::Round($top); words = $words }
  }
  [ordered]@{ width = $bitmap.PixelWidth; lines = $lines }
}

$file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($Path)) ([Windows.Storage.StorageFile])
$pages = @()
if ([IO.Path]::GetExtension($Path).ToLower() -eq '.pdf') {
  $pdf = Await ([Windows.Data.Pdf.PdfDocument]::LoadFromFileAsync($file)) ([Windows.Data.Pdf.PdfDocument])
  $n = [Math]::Min([int]$pdf.PageCount, $MaxPages)
  for ($i = 0; $i -lt $n; $i++) {
    $page = $pdf.GetPage([uint32]$i)
    $opts = New-Object Windows.Data.Pdf.PdfPageRenderOptions
    $opts.DestinationWidth = [uint32][Math]::Min(2400, $max)
    $mem = New-Object Windows.Storage.Streams.InMemoryRandomAccessStream
    AwaitAction ($page.RenderToStreamAsync($mem, $opts))
    $pages += Read-Page (Read-Bitmap $mem)
    $page.Dispose()
  }
} else {
  $stream = Await ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
  $pages += Read-Page (Read-Bitmap $stream)
}

$json = [ordered]@{ lang = $engine.RecognizerLanguage.LanguageTag; pages = $pages } | ConvertTo-Json -Depth 8 -Compress
# Solo ASCII (acentos como \uXXXX): así la salida no depende de la codificación de la consola.
[regex]::Replace($json, '[^\x00-\x7F]', { param($m) '\u{0:x4}' -f [int][char]$m.Value })
