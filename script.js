const video = document.getElementById('video');

// Function to start the camera
async function startCamera() {
    try {
        // Ask for camera permission and get the video stream
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment' } // Use the back camera
        });
        // Connect the camera stream to our video element
        video.srcObject = stream;
    } catch (err) {
        console.error("Error accessing camera: ", err);
        alert("Could not access the camera. Please grant permission.");
    }
}

// Call the function to start the camera when the page loads
startCamera();