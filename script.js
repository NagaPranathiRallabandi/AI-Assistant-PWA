// Import the Google AI library directly using the ES Module URL
import { GoogleGenerativeAI } from "https://esm.run/@google/generative-ai";

// This event listener ensures the HTML is ready before the script runs
window.addEventListener('DOMContentLoaded', () => {

    const video = document.getElementById('video');
    const analyzeButton = document.getElementById('analyzeButton');
    const voiceButton = document.getElementById('voiceButton');
    const loadingDiv = document.getElementById('loading');
    
    let isBusy = false;
    let currentCompassHeading = 0;
    
    // ⚠️ IMPORTANT: Paste your actual API key here!
    const API_KEY = "AIzaSyD6bXgBjkl_uRaH5vrVYjciwxdj6FO0F50";
    
    // Initialize the Generative AI client
    const genAI = new GoogleGenerativeAI(API_KEY);
    const geminiModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
    
    // --- Setup Functions ---
    startCamera();
    setupVoiceCommands();
    startOrientationSensor();

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

    function startOrientationSensor() {
        if ('DeviceOrientationEvent' in window) {
            window.addEventListener('deviceorientation', (event) => {
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

    // Updated to understand a new "recognize_object" intent
    async function getIntent(commandText) {
        const prompt = `
            You are an intent classifier for a voice-controlled accessibility app.
            Classify the command into one of the following categories:
            'analyze_scene', 'get_direction', 'read_text', 'recognize_currency', 'recognize_object', or 'unknown'.
            Only return the category name.

            --
            Examples:
            Command: "Describe my surroundings" -> Intent: analyze_scene
            Command: "Which way should I go" -> Intent: get_direction
            Command: "What does this sign say" -> Intent: read_text
            Command: "Identify this money" -> Intent: recognize_currency
            Command: "What is this object" -> Intent: recognize_object
            Command: "Tell me what this is" -> Intent: recognize_object
            Command: "How are you today" -> Intent: unknown
            --

            Command: "${commandText}"
            Intent:
        `;

        try {
            const result = await geminiModel.generateContent(prompt);
            const response = await result.response;
            const intent = response.text().trim().toLowerCase().replace(/['"]/g, '');
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

        voiceButton.addEventListener('click', () => {
            if (!isBusy) {
                voiceButton.disabled = true;
                voiceButton.textContent = "Listening...";
                recognition.start();
            }
        });
        
        recognition.onend = () => {
            voiceButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>`;
            voiceButton.disabled = false;
        };

        // Updated to handle the new "recognize_object" intent
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
                case 'read_text':
                    speak("Okay, looking for text to read.");
                    performTextRecognition();
                    break;
                case 'recognize_currency':
                    speak("Okay, identifying the currency.");
                    performCurrencyRecognition();
                    break;
                case 'recognize_object':
                    speak("Okay, identifying the object.");
                    performObjectRecognition();
                    break;
                default:
                    speak("Sorry, I didn't understand that command.");
                    break;
            }
        };
    }
    
    async function performSceneAnalysis() {
        if (isBusy) return;
        setUIBusyState(true);
        try {
            const imagePart = captureImageAsPart();
            const prompt = `Act as an accessibility assistant. Describe the scene in a single, fluid sentence. If a person's emotion is clearly visible, weave it into the description naturally.`;
            const result = await geminiModel.generateContent([prompt, imagePart]);
            const response = await result.response;
            speak(response.text());
        } catch (error) {
            console.error("Error during scene analysis:", error);
            speak("Sorry, I couldn't analyze the scene.");
        } finally {
            setUIBusyState(false);
        }
    }

    async function performDirectionAnalysis() {
        if (isBusy) return;
        setUIBusyState(true);
        try {
            const imagePart = captureImageAsPart();
            const heading = Math.round(currentCompassHeading);
            const prompt = `Act as a navigation assistant. The user's phone is pointing forward at a compass heading of ${heading} degrees (0=N, 90=E). Describe the most prominent path or object in a short, clear instruction.`;
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

    async function performTextRecognition() {
        if (isBusy) return;
        setUIBusyState(true);
        try {
            const imagePart = captureImageAsPart();
            const prompt = `Act as an accessibility assistant. Perform OCR on the image. Extract and read all text exactly as it appears. If no text is found, respond with "No text found."`;
            const result = await geminiModel.generateContent([prompt, imagePart]);
            const response = await result.response;
            speak(response.text());
        } catch (error) {
            console.error("Error during text recognition:", error);
            speak("Sorry, I was unable to read the text.");
        } finally {
            setUIBusyState(false);
        }
    }

    async function performCurrencyRecognition() {
        if (isBusy) return;
        setUIBusyState(true);
        try {
            const imagePart = captureImageAsPart();
            const prompt = `Act as an accessibility assistant. Identify the currency in the image (banknote or coin). Prioritize Indian Rupees (INR). State the denomination clearly (e.g., "This is a 500 Rupee note."). If unidentifiable, respond with "No currency detected."`;
            const result = await geminiModel.generateContent([prompt, imagePart]);
            const response = await result.response;
            speak(response.text());
        } catch (error) {
            console.error("Error during currency recognition:", error);
            speak("Sorry, I could not identify the currency.");
        } finally {
            setUIBusyState(false);
        }
    }

    // New function for Object Recognition
    async function performObjectRecognition() {
        if (isBusy) return;
        setUIBusyState(true);
        try {
            const imagePart = captureImageAsPart();
            const prompt = `Act as an accessibility assistant. Identify the single, most prominent object in the center of the image. Respond with a short phrase, for example: "This is a water bottle." or "It looks like a laptop." If no object is clear, say "I can't identify a specific object."`;
            const result = await geminiModel.generateContent([prompt, imagePart]);
            const response = await result.response;
            speak(response.text());
        } catch (error) {
            console.error("Error during object recognition:", error);
            speak("Sorry, I could not identify the object.");
        } finally {
            setUIBusyState(false);
        }
    }

    function captureImageAsPart() {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageDataUrl = canvas.toDataURL('image/jpeg');
        return {inlineData: {data: imageDataUrl.split(',')[1], mimeType: 'image/jpeg'}};
    }

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