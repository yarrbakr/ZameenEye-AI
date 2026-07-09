import os
import shutil
from PIL import Image

base_path = r"C:\Users\Kainat\ZameenEye-AI\python\cv\Wildfire-1"
folders = ['train', 'valid','test']

for folder in folders:
    folder_path = os.path.join(base_path, folder)
    if not os.path.exists(folder_path):
        continue
        
    print(f"📦 Restructuring and normalizing coordinates for: {folder}...")
    
    img_dir = os.path.join(folder_path, 'images')
    lbl_dir = os.path.join(folder_path, 'labels')
    
    # Temporarily check both the main folder and subfolder for files
    search_img_dir = img_dir if os.path.exists(img_dir) else folder_path
    
    os.makedirs(img_dir, exist_ok=True)
    os.makedirs(lbl_dir, exist_ok=True)
    
    ann_file = os.path.join(folder_path, '_annotations.txt')
    if not os.path.exists(ann_file):
        ann_file = os.path.join(img_dir, '_annotations.txt') # check if moved inside
        
    if os.path.exists(ann_file):
        with open(ann_file, 'r') as f:
            lines = f.readlines()
            
        for line in lines:
            # Handle comma-separated values inside the text row cleanly
            clean_line = line.strip().replace(',', ' ')
            parts = clean_line.split()
            if not parts or len(parts) < 6:
                continue
                
            filename = parts[0]
            # Coordinates are: x_min, y_min, x_max, y_max, class_id
            try:
                xmin = float(parts[1])
                ymin = float(parts[2])
                xmax = float(parts[3])
                ymax = float(parts[4])
                class_id = parts[5]
            except ValueError:
                continue
            
            # Find image path to calculate width & height for normalization
            img_path = os.path.join(search_img_dir, filename)
            if not os.path.exists(img_path):
                continue
                
            with Image.open(img_path) as img:
                dw = 1.0 / img.width
                dh = 1.0 / img.height
                
            # Convert Pascal VOC bounding box to YOLO normalized center format
            x_center = ((xmin + xmax) / 2.0) * dw
            y_center = ((ymin + ymax) / 2.0) * dh
            w = (xmax - xmin) * dw
            h = (ymax - ymin) * dh
            
            label_filename = os.path.splitext(filename)[0] + '.txt'
            with open(os.path.join(lbl_dir, label_filename), 'w') as lf:
                lf.write(f"{class_id} {x_center:.6f} {y_center:.6f} {w:.6f} {h:.6f}\n")
                
    # Safeguard: Cleanly move all pictures into their formal /images bucket
    for file in os.listdir(folder_path):
        if file.lower().endswith(('.jpg', '.jpeg', '.png')):
            shutil.move(os.path.join(folder_path, file), os.path.join(img_dir, file))

print("✅ Bounding boxes normalized and reformatted perfectly for YOLOv8!")