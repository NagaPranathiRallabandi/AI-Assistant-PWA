// Import the Google AI library directly using the ES Module URL
import { GoogleGenerativeAI } from "https://esm.run/@google/generative-ai";

// This event listener ensures the HTML is ready before the script runs
window.addEventListener('DOMContentLoaded', () => {

    const video = document.getElementById('video');
    const analyzeButton = document.getElementById('analyzeButton');
    const voiceButton = document.getElementById('voiceButton');
    const loadingDiv = document.getElementById('loading');
    
    let isBusy = false;
    let currentCompassHeading = 0; // Variable to store the phone's compass direction
    
    // ⚠️ IMPORTANT: Paste your actual API key here!
    const API_KEY = "AIzaSyDe6kxxxGQH3SBDoeFpeP6nwT0KohyANSc";
    
    // Initialize the Generative AI client
    const genAI = new GoogleGenerativeAI(API_KEY);
    const geminiModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
    // const geminiModel = genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" });
    
    // --- Setup Functions ---
    startCamera();
    setupVoiceCommands();
    startOrientationSensor(); // Start listening to the phone's compass

    // --- Core Functions ---
    async function startCamera() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: { ideal: 'environment' } } 
            });
            video.srcObject = stream;
            video.onloadedmetadata = () => console.log("Camera stream successfully attached.");
        } catch (err) {
            console.error("Error accessing camera: ", err);
            alert("Could not access the camera.");
        }
    }

    // New function to listen for compass data
    function startOrientationSensor() {
        if ('DeviceOrientationEvent' in window) {
            window.addEventListener('deviceorientation', (event) => {
                // event.alpha is the compass direction in degrees (0=North, 90=East)
                if (event.alpha) {
                    currentCompassHeading = event.alpha;
                }
            }, true);
            console.log("Orientation sensor started.");
        } else {
            console.warn("Device orientation not supported by this browser.");
        }
    }
    
    function speak(text) {
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(text);
            window.speechSynthesis.speak(utterance);
        } else {
            console.error("Speech synthesis not supported in this browser.");
        }
    }

    // Updated to understand a new "get_direction" intent
    async function getIntent(commandText) {
        const prompt = `
            You are an intent classifier for a voice-controlled accessibility app.
            Analyze the user's command and classify it into one of the following categories:
            'analyze_scene', 'get_direction', or 'unknown'.
            Only return the category name and nothing else.

            --
            Examples:
            Command: "Describe my surroundings" -> Intent: analyze_scene
            Command: "What am I looking at" -> Intent: analyze_scene
            Command: "Which way should I go" -> Intent: get_direction
            Command: "Where is the exit" -> Intent: get_direction
            Command: "Tell me the direction" -> Intent: get_direction
            Command: "How are you today" -> Intent: unknown
            --

            Command: "${commandText}"
            Intent:
        `;

        try {
            const result = await geminiModel.generateContent(prompt);
            const response = await result.response;
            const intent = response.text().trim().toLowerCase();
            console.log(`Intent recognized: ${intent}`);
            return intent;
        } catch (error) {
            console.error("Error getting intent:", error);
            return 'unknown';
        }
    }

    function setupVoiceCommands() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            voiceButton.disabled = true;
            voiceButton.textContent = "Voice N/A";
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        voiceButton.addEventListener('click', () => recognition.start());

        recognition.onstart = () => {
            voiceButton.textContent = "Listening...";
            voiceButton.disabled = true;
        };
        
        recognition.onend = () => {
            voiceButton.textContent = "🎤"; // Use emoji only for consistency
            voiceButton.disabled = false;
        };

        // Updated to handle multiple intents
        recognition.onresult = async (event) => {
            const command = event.results[0][0].transcript.toLowerCase().trim();
            console.log('Voice command heard:', command);

            const intent = await getIntent(command);

            switch (intent) {
                case 'analyze_scene':
                    speak("Okay, analyzing the scene.");
                    performSceneAnalysis();
                    break;
                case 'get_direction':
                    speak("Okay, looking for a path forward.");
                    performDirectionAnalysis();
                    break;
                default:
                    speak("Sorry, I didn't understand that command.");
                    break;
            }
        };
    }
    
    async function performSceneAnalysis() {
        if (isBusy) return;
        isBusy = true;
        
        setUIBusyState(true);
    
        try {
            const imagePart = captureImageAsPart();
            const prompt = `
                Act as an accessibility assistant for a visually impaired person. 
                Describe the scene in a single, fluid sentence. 
                If a person's emotion is clearly visible, weave it into the description naturally.
            `;
            
            const result = await geminiModel.generateContent([prompt, imagePart]);
            const response = await result.response;
            let finalSpeech = response.text();

            if (finalSpeech.startsWith("Final Description:")) {
                finalSpeech = finalSpeech.replace("Final Description:", "").trim();
            }
            speak(finalSpeech);
            console.log(finalSpeech);
    
        } catch (error) {
            console.error("Error during scene analysis:", error);
            if (error.toString().includes("503")) {
                speak("The AI service is currently busy. Please try again in a moment.");
            } else {
                speak("Sorry, I couldn't analyze the scene.");
            }
        } finally {
            setUIBusyState(false);
        }
    }

    // New function specifically for directional commands
    async function performDirectionAnalysis() {
        if (isBusy) return;
        isBusy = true;

        setUIBusyState(true);

        try {
            const imagePart = captureImageAsPart();
            const heading = Math.round(currentCompassHeading);

            const prompt = `
                Act as a navigation assistant for a visually impaired person.
                The user is holding their phone, and the camera is pointing forward.
                The phone's current compass heading is approximately ${heading} degrees (0 is North, 90 is East, 180 is South, 270 is West).
                Analyze the image to identify the most prominent object, path, or door.
                Describe its location relative to the user in a short, clear instruction.
                For example: "There is a door directly in front of you." or "The main hallway continues forward, slightly to your left."
            `;

            const result = await geminiModel.generateContent([prompt, imagePart]);
            const response = await result.response;
            speak(response.text());

        } catch (error) {
            console.error("Error during direction analysis:", error);
            speak("Sorry, I couldn't determine the direction.");
        } finally {
            setUIBusyState(false);
        }
    }

    // Helper function to capture an image
    function captureImageAsPart() {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageDataUrl = canvas.toDataURL('image/jpeg');
        return {inlineData: {data: imageDataUrl.split(',')[1], mimeType: 'image/jpeg'}};
    }

    // Helper function to manage the UI state
    function setUIBusyState(busy) {
        isBusy = busy;
        analyzeButton.disabled = busy;
        voiceButton.disabled = busy;
        loadingDiv.style.display = busy ? 'block' : 'none';
        if (busy) {
            analyzeButton.textContent = "Analyzing...";
        } else {
            analyzeButton.textContent = "Analyze Scene";
        }
    }
    
    analyzeButton.addEventListener('click', performSceneAnalysis);
});