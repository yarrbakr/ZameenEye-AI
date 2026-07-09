from roboflow import Roboflow

# Initialize the client
rf = Roboflow(api_key="jMBvgjykdR51bhePRFWM")

# Access your workspace and project
workspace = rf.workspace("kainat-khan-2r7d9")
project = workspace.project("wildfire-4tdl8-i19mt")

# Target the version and download the package
version = project.version(1)

print("Downloading the weights package...")
# Change 'model.download' to 'version.download'
dataset = version.download("yolov8") 
print("Download complete!")


