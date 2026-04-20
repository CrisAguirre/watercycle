Add-Type -AssemblyName System.IO.Compression.FileSystem

$docs = Get-ChildItem "src\assets\docs\*.docx"

foreach ($doc in $docs) {
    Write-Host "--- CONTENT OF $($doc.Name) ---"
    try {
        $zip = [System.IO.Compression.ZipFile]::OpenRead($doc.FullName)
        $docXmlEntry = $zip.Entries | Where-Object { $_.FullName -eq 'word/document.xml' }
        if ($docXmlEntry) {
            $stream = $docXmlEntry.Open()
            $reader = New-Object IO.StreamReader($stream, [System.Text.Encoding]::UTF8)
            $xml = $reader.ReadToEnd()
            $reader.Close()
            $stream.Close()
            
            # Improved regex to preserve paragraphs
            # w:p indicates a parameter, w:t indicates text
            $xmlDoc = [xml]$xml
            $ns = New-Object System.Xml.XmlNamespaceManager($xmlDoc.NameTable)
            $ns.AddNamespace("w", "http://schemas.openxmlformats.org/wordprocessingml/2006/main")
            
            $paragraphs = $xmlDoc.SelectNodes("//w:p", $ns)
            foreach ($p in $paragraphs) {
                # Get all text elements within the paragraph
                $texts = $p.SelectNodes(".//w:t", $ns)
                $paraText = ""
                foreach ($t in $texts) {
                    $paraText += $t.InnerText
                }
                if (![string]::IsNullOrWhiteSpace($paraText)) {
                    Write-Host $paraText
                }
            }
        }
        $zip.Dispose()
    } catch {
        Write-Host "Error: $_"
    }
    Write-Host "=========================="
}
