import zipfile
import xml.etree.ElementTree as ET
import sys
import glob
import os

for path in glob.glob(r"src/assets/docs/*.docx"):
    print(f"--- CONTENT OF {os.path.basename(path)} ---")
    try:
        with zipfile.ZipFile(path) as z:
            xml_content = z.read('word/document.xml')
            tree = ET.fromstring(xml_content)
            # The namespace for w:t (text nodes)
            ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
            
            # To get a more readable format, extract paragraphs:
            para_ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
            for para in tree.iterfind('.//w:p', para_ns):
                texts = [node.text for node in para.iterfind('.//w:t', para_ns) if node.text]
                if texts:
                    print(''.join(texts))
                else:
                    print('')
    except Exception as e:
        print(f"Error reading {path}: {str(e)}")
    print("==========================\n")
