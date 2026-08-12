Add-Type -AssemblyName System.Drawing
$out = Join-Path $PSScriptRoot '..\assets\sprites.png'
$dir = Split-Path $out
New-Item -ItemType Directory -Path $dir -Force | Out-Null
$bmp = New-Object System.Drawing.Bitmap 512,256
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.Clear([System.Drawing.Color]::Transparent)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::None
$outline = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255,14,18,19)),3
$colors = @(
  [System.Drawing.Color]::FromArgb(255,223,183,110),
  [System.Drawing.Color]::FromArgb(255,195,111,121),
  [System.Drawing.Color]::FromArgb(255,113,170,178),
  [System.Drawing.Color]::FromArgb(255,159,168,108)
)
for ($person=0; $person -lt 4; $person++) {
  $brush = New-Object System.Drawing.SolidBrush $colors[$person]
  for ($frame=0; $frame -lt 4; $frame++) {
    $x = $frame*32
    $y = $person*48
    $g.FillEllipse($brush,$x+11,$y+3,10,10)
    $g.DrawEllipse($outline,$x+11,$y+3,10,10)
    $g.FillRectangle($brush,$x+9,$y+14,14,20)
    $g.DrawRectangle($outline,$x+9,$y+14,14,20)
    $step = if ($frame % 2 -eq 0) { 3 } else { -3 }
    $g.DrawLine($outline,$x+13,$y+34,$x+11+$step,$y+44)
    $g.DrawLine($outline,$x+19,$y+34,$x+21-$step,$y+44)
  }
  $brush.Dispose()
}
$itemColors = @(
  [System.Drawing.Color]::FromArgb(255,205,190,145),[System.Drawing.Color]::FromArgb(255,220,214,185),
  [System.Drawing.Color]::FromArgb(255,165,115,170),[System.Drawing.Color]::FromArgb(255,78,103,105),
  [System.Drawing.Color]::FromArgb(255,180,104,75),[System.Drawing.Color]::FromArgb(255,220,164,68),
  [System.Drawing.Color]::FromArgb(255,187,151,89),[System.Drawing.Color]::FromArgb(255,207,198,165)
)
for ($i=0;$i -lt 8;$i++){
  $b=New-Object System.Drawing.SolidBrush $itemColors[$i]
  $x=160+($i%4)*40;$y=[math]::Floor($i/4)*40+16
  $g.FillRectangle($b,$x+6,$y+6,28,24);$g.DrawRectangle($outline,$x+6,$y+6,28,24)
  $b.Dispose()
}
$font = New-Object System.Drawing.Font 'Arial',10
$labelBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255,230,226,210))
$g.DrawString('SULAN   YAO     LUHUI    LUOYI',$font,$labelBrush,2,198)
$bmp.Save($out,[System.Drawing.Imaging.ImageFormat]::Png)
$labelBrush.Dispose();$font.Dispose();$outline.Dispose();$g.Dispose();$bmp.Dispose()
Write-Output $out
