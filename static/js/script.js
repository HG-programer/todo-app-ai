// Paste this complete code into your script.js file

document.addEventListener('DOMContentLoaded', () => {

    // --- SECTION 1: Get References to Elements ---
    const addTaskForm = document.getElementById('addTaskForm');
    const taskInput = document.getElementById('taskInput');
    const taskList = document.getElementById('taskList'); // UL element
    const themeToggleButton = document.getElementById('theme-toggle-btn');
    const aiModalElement = document.getElementById('aiResponseModal');
    const modalTitleSpan = document.getElementById('modalTaskTitle'); // Expected within modal header
    const modalBody = document.getElementById('aiResponseModalBody'); // Expected within modal body
    const noTasksMsg = document.getElementById('noTasksMessage'); // Message shown when list is empty
    const voiceInputBtn = document.getElementById('voiceInputBtn');
    const globalMotivateButton = document.getElementById('global-motivate-button'); // New global button
    // --- End Section 1 ---

    // --- Helper: Prevent XSS ---
    // Ensure this has the CORRECT mappings
    function escapeHTML(str) {
        if (typeof str !== 'string') return '';
        return str.replace(/[&<>"']/g, function (match) {
            return {
                '&': '&', // Correct mapping
                '<': '<',  // Correct mapping
                '>': '>',  // Correct mapping
                '"': '"', // Correct mapping
                "'": '&#39;'
            }[match];
        });
    }

    // --- SECTION 2: Core Task Submission Logic ---
    async function submitNewTask(taskContent) {
        if (!taskContent || taskContent.trim() === "") { console.warn("Attempted to submit empty task."); alert("Task content cannot be empty."); return; }
        const submitButton = addTaskForm ? addTaskForm.querySelector('button[type="submit"]') : null;
        const originalButtonHTML = submitButton ? submitButton.innerHTML : 'Add Task';
        if(submitButton) { submitButton.disabled = true; submitButton.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Adding...`; }
        if(voiceInputBtn) voiceInputBtn.disabled = true;
        try {
            const response = await fetch("/add", { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: taskContent }) });
            const result = await response.json();
            if (response.status === 201 && result.success && result.task) {
                addNewTaskToList(result.task); if(taskInput) taskInput.value = ''; console.log(`Task "${taskContent}" added successfully.`);
            } else { throw new Error(result.error || `Status: ${response.status}`); }
        } catch (error) { console.error('Error adding task:', error.message); alert(`Error adding task: ${error.message}`);
        } finally {
            if(submitButton) { submitButton.disabled = false; submitButton.innerHTML = originalButtonHTML; }
            if(voiceInputBtn && (!recognitionActive)) { resetVoiceButton(); } // Only reset if not handled by onend
        }
    }
    // --- End Section 2 ---


    // --- SECTION 3: Add Task Form Event Listener ---
    if (addTaskForm) {
        addTaskForm.addEventListener('submit', (event) => { // Can be synchronous if submitNewTask handles async
            event.preventDefault();
            const taskText = taskInput.value.trim();
            submitNewTask(taskText);
        });
    } else { console.error("Add Task form (#addTaskForm) not found!"); }
    // --- End Section 3 ---


    // --- SECTION 4: Task List Event Delegation ---
    if (taskList) {
        taskList.addEventListener('click', (event) => { // No need for async here unless handlers are complex
            const target = event.target;
            const button = target.closest('button');
            if (!button) return;
            const listItem = button.closest('.task-item');
            if (!listItem) return;
            const taskId = listItem.dataset.taskId;

            if (button.classList.contains('ask-ai-btn')) {
                const taskText = button.dataset.taskText;
                handleAskAiClick(button, taskText); // handleAskAiClick is async
            } else if (button.classList.contains('delete-btn')) {
                handleDeleteClick(button, taskId); // handleDeleteClick is async
            }
        });
        taskList.addEventListener('change', (event) => { // No need for async here
             const target = event.target;
            if (target.classList.contains('task-checkbox') && target.type === 'checkbox') {
                const checkbox = target;
                const listItem = checkbox.closest('.task-item');
                if (!listItem) return;
                const taskId = listItem.dataset.taskId;
                handleCheckboxChange(checkbox, taskId); // handleCheckboxChange is async
            }
        });
    } else { console.error("Task list (#taskList) element not found!"); }
    // --- End Section 4 ---


    // --- SECTION 5: Helper Function to Create and Add New Task LI Element ---
    function addNewTaskToList(task) {
        if (!taskList || !task || typeof task.id === 'undefined') { console.error("Cannot add task to list.", task); return; }
        const li = document.createElement('li');
        li.className = `list-group-item task-item d-flex justify-content-between align-items-center ${task.completed ? 'task-completed' : ''}`;
        li.dataset.taskId = task.id;
        const taskContentDiv = document.createElement('div'); taskContentDiv.className = 'd-flex align-items-center me-3 flex-grow-1';
        const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.className = 'form-check-input task-checkbox me-2'; checkbox.checked = task.completed; checkbox.id = `task-${task.id}`;
        const span = document.createElement('span'); span.className = 'task-text'; span.textContent = task.content; // Use textContent for safety
        taskContentDiv.appendChild(checkbox); taskContentDiv.appendChild(span);
        const buttonDiv = document.createElement('div'); buttonDiv.className = 'task-buttons btn-group';
        const aiButton = document.createElement('button'); aiButton.type = "button"; aiButton.className = 'ask-ai-btn btn btn-outline-info btn-sm'; aiButton.title = "Ask AI about this task"; aiButton.dataset.taskText = task.content; aiButton.innerHTML = '<i class="bi bi-magic"></i> <span class="visually-hidden">Ask AI</span>';
        const deleteButton = document.createElement('button'); deleteButton.type = "button"; deleteButton.className = 'delete-btn btn btn-outline-danger btn-sm'; deleteButton.title = "Delete this task"; deleteButton.innerHTML = '<i class="bi bi-trash"></i> <span class="visually-hidden">Delete</span>';
        buttonDiv.appendChild(aiButton); buttonDiv.appendChild(deleteButton);
        li.appendChild(taskContentDiv); li.appendChild(buttonDiv);
        taskList.appendChild(li);
        requestAnimationFrame(() => { li.classList.add('task-fade-in'); });
        li.addEventListener('animationend', () => { li.classList.remove('task-fade-in'); }, { once: true });
        if (noTasksMsg && noTasksMsg.style.display !== 'none') { noTasksMsg.style.display = 'none'; }
    }
    // --- End Section 5 ---


    // --- SECTION 6: Task Action Handlers ---
    async function handleAskAiClick(button, taskText) {
        if (!taskText || taskText.trim() === "") { alert("Cannot ask AI about an empty task."); return; }
        button.disabled = true; const originalContent = button.innerHTML; button.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> <span class="visually-hidden">Asking...</span>`;
        try {
            const response = await fetch('/ask-ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ task_text: taskText }) });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || `HTTP Error ${response.status}`);
            displayModalResponse(`AI Details for "${escapeHTML(taskText)}"`, result, true, "");
        } catch (error) { console.error('Error/Network (Ask AI):', error.message); displayModalResponse("Error", { error: error.message }, false, "Could not contact AI service:");
        } finally { button.disabled = false; button.innerHTML = originalContent; }
    }

    async function handleCheckboxChange(checkbox, taskId) {
        const isCompleted = checkbox.checked; const listItem = checkbox.closest('.task-item'); if (!listItem) return;
        listItem.classList.toggle('task-completed', isCompleted); // Optimistic
        try {
            const response = await fetch(`/complete/${taskId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, });
            const result = await response.json();
            if (!response.ok || !result.success) { throw new Error(result.error || 'Server error'); }
            checkbox.checked = result.completed_status; // Confirm state
            listItem.classList.toggle('task-completed', result.completed_status);
            console.log(`Task ${taskId} completion status updated to: ${result.completed_status}`);
        } catch (error) {
            console.error('Error/Network updating task status:', error.message);
            checkbox.checked = !isCompleted; listItem.classList.toggle('task-completed', !isCompleted); // Rollback
            alert(`Error updating task: ${error.message}`);
        }
    }

    async function handleDeleteClick(button, taskId, skipConfirmation = false) {
        if (!skipConfirmation && !confirm(`Are you sure you want to delete this task?`)) { return; }
        button.disabled = true; const originalContent = button.innerHTML; button.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> <span class="visually-hidden">Deleting...</span>`;
        const listItem = button.closest('.task-item'); if (!listItem) { console.error(`Could not find list item (ID: ${taskId})`); if (!skipConfirmation) { button.disabled = false; button.innerHTML = originalContent; } return; }
        try {
            const response = await fetch(`/delete/${taskId}`, { method: 'POST' });
            const result = await response.json();
            if (!response.ok || !result.success) { throw new Error(result.error || 'Server error'); }
            console.log(`Task ${taskId} delete request successful (Conf skipped: ${skipConfirmation}).`);
            listItem.classList.add('task-fade-out');
            listItem.addEventListener('animationend', () => {
                listItem.remove(); console.log(`Task ${taskId} removed from DOM.`);
                if (taskList && taskList.children.length === 0 && noTasksMsg) { noTasksMsg.style.display = 'block'; }
            }, { once: true });
        } catch (error) {
            console.error(`Error/Network deleting task ${taskId}:`, error.message);
            if (!skipConfirmation) { alert(`Error deleting task: ${error.message}`); button.disabled = false; button.innerHTML = originalContent; }
        }
    }
    // --- End Section 6 ---


    // --- SECTION 7: General Motivation Handling & Speech Synthesis ---
    async function triggerGeneralMotivation() {
        const modalInstance = bootstrap.Modal.getOrCreateInstance(aiModalElement);
        if (modalTitleSpan) modalTitleSpan.textContent = 'Getting Motivation...'; if (modalBody) modalBody.innerHTML = '<div class="d-flex justify-content-center"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div></div>'; modalInstance.show();
        const originalButtonHTML = globalMotivateButton ? globalMotivateButton.innerHTML : null; if(globalMotivateButton) { globalMotivateButton.disabled = true; globalMotivateButton.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Thinking...`; }
        try {
            const response = await fetch('/motivate-me', { method: 'POST' });
            const result = await response.json(); if (!response.ok) { throw new Error(result.error || `HTTP error! status: ${response.status}`); }
            if (modalTitleSpan) modalTitleSpan.textContent = 'A Dose of Motivation!'; if (modalBody) { modalBody.innerHTML = `<blockquote class="blockquote mb-0"><p>${escapeHTML(result.motivation)}</p></blockquote>`; }
        } catch (error) { console.error('Error fetching motivation:', error.message); if (modalTitleSpan) modalTitleSpan.textContent = 'Error'; if (modalBody) modalBody.textContent = `Sorry, couldn't get motivation: ${error.message}`;
        } finally { if(globalMotivateButton && originalButtonHTML) { globalMotivateButton.disabled = false; globalMotivateButton.innerHTML = originalButtonHTML; } }
    }
    if (globalMotivateButton) { globalMotivateButton.addEventListener('click', triggerGeneralMotivation); } else { console.log("Global motivate button not found."); }

    function displayModalResponse(title, result, isOk, errorPrefix, responseKey = 'details') {
         if (!modalTitleSpan || !modalBody || !aiModalElement) { console.error("Modal elements missing!"); alert(isOk ? (result[responseKey] || "Empty response.") : `${errorPrefix} ${result.error || 'UI Error.'}`); return; }
         if (typeof bootstrap === 'undefined' || !bootstrap.Modal) { console.error("Bootstrap Modal component not loaded!"); alert("UI Component (Modal) error."); return; }
        const aiModal = bootstrap.Modal.getOrCreateInstance(aiModalElement); modalTitleSpan.textContent = title;
        if (isOk) { modalBody.innerHTML = escapeHTML(result[responseKey] || "Received empty response from AI.").replace(/\n/g, '<br>'); }
        else { modalBody.textContent = `${errorPrefix} ${result.error || 'Unknown server error'}`; }
        aiModal.show();
    }

    const supportsSpeechSynthesis = 'speechSynthesis' in window;
    if (!supportsSpeechSynthesis) { console.warn("Browser does not support Speech Synthesis."); }

    function readTasksAloud() {
        if (!supportsSpeechSynthesis) { alert("Sorry, your browser cannot read tasks aloud."); return; }
        if (!taskList) { console.error("Task list element not found, cannot read tasks."); return; }
        const taskItems = taskList.querySelectorAll('li.task-item'); let textToSpeak = ""; let taskCount = taskItems.length;
        if (taskCount === 0) { textToSpeak = "You have no tasks."; }
        else {
            let tasksStrings = [];
            taskItems.forEach((item) => {
                const taskTextElement = item.querySelector('.task-text'); const isCompleted = item.classList.contains('task-completed');
                if (taskTextElement) { const statusPrefix = isCompleted ? "Completed: " : ""; tasksStrings.push(`${statusPrefix}${taskTextElement.textContent}.`); } // Added period for flow
            });
            const plural = taskCount === 1 ? "task" : "tasks"; textToSpeak = `Okay, you have ${taskCount} ${plural}. ${tasksStrings.join(' ')}`; // Use space joiner
        }
        console.log("Attempting to speak:", `"${textToSpeak}"`);
        window.speechSynthesis.cancel(); // Cancel previous speech
        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        utterance.lang = 'en-US'; utterance.rate = 1.0; utterance.pitch = 1.0;
        utterance.onstart = () => console.log("SpeechSynthesis starting..."); utterance.onend = () => console.log("SpeechSynthesis finished.");
        utterance.onerror = (event) => { console.error("SpeechSynthesis Error:", event.error); alert(`Speech synthesis error: ${event.error}`); };
        window.speechSynthesis.speak(utterance);
    }
    // --- End Section 7 ---


    // --- SECTION 8: Initial UI Setup ---
    document.querySelectorAll('.task-checkbox').forEach(checkbox => { const listItem = checkbox.closest('.task-item'); if (listItem) { listItem.classList.toggle('task-completed', checkbox.checked); } });
    if (taskList && taskList.children.length === 0 && noTasksMsg) { noTasksMsg.style.display = 'block'; } else if (noTasksMsg) { noTasksMsg.style.display = 'none'; }
    // --- End Section 8 ---


    // --- SECTION 9: Theme Toggling Logic ---
    // --- SECTION 9: Theme Toggling Logic ---

// Define available themes
const availableThemes = ['light', 'dark', 'forest', 'ocean'];
const themeIcons = { // Optional: map themes to icons
    'light': '<i class="bi bi-sun-fill"></i>',
    'dark': '<i class="bi bi-moon-stars-fill"></i>',
    'forest': '<i class="bi bi-tree-fill"></i>', // Example
    'ocean': '<i class="bi bi-water"></i>'      // Example
};

// Function to apply a theme
function applyTheme(themeName) {
    if (!availableThemes.includes(themeName)) {
        console.warn(`Theme "${themeName}" not recognized. Defaulting to "light".`);
        themeName = 'light'; // Fallback to default
    }

    console.log(`Applying theme: ${themeName}`);
    // Set the data-theme attribute on the <html> element
    document.documentElement.dataset.theme = themeName;

    // Update the theme toggle button text/icon
    if (themeToggleButton) {
        const iconHTML = themeIcons[themeName] || ''; // Get icon or empty string
        // Capitalize theme name for display
        const displayName = themeName.charAt(0).toUpperCase() + themeName.slice(1);
        themeToggleButton.innerHTML = `${iconHTML} Theme: ${displayName}`;
        themeToggleButton.title = `Current theme: ${displayName}. Click to change.`;
    }

    // Save the selected theme to localStorage
    try {
        localStorage.setItem('theme', themeName);
    } catch (e) {
        console.error("Could not save theme to localStorage:", e);
    }
}

// Function to load and apply theme preference on page load
function loadAndApplyInitialTheme() {
    let preferredTheme = 'light'; // Default theme

    // 1. Check localStorage
    try {
        const storedTheme = localStorage.getItem('theme');
        if (storedTheme && availableThemes.includes(storedTheme)) {
            preferredTheme = storedTheme;
            console.log(`Loaded theme from localStorage: ${preferredTheme}`);
        } else if (storedTheme) {
             console.warn(`Stored theme "${storedTheme}" is invalid. Using default.`);
         }
    } catch (e) {
        console.error("Could not read theme from localStorage:", e);
    }

    // 2. Optional: Check system preference IF no valid stored theme
    //    (Comment this out if you prefer localStorage to always win)
    /*
    if (preferredTheme === 'light' && !localStorage.getItem('theme')) { // Only check system if no user choice is stored
         const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');
         if (prefersDarkScheme.matches && availableThemes.includes('dark')) {
              preferredTheme = 'dark';
              console.log("No stored theme, using system preference: dark");
         }
     }
    */

    applyTheme(preferredTheme); // Apply the determined theme
}

// Attach event listener to the theme toggle button
if (themeToggleButton) {
    themeToggleButton.addEventListener('click', () => {
        const currentTheme = document.documentElement.dataset.theme || 'light'; // Get current theme from attribute
        const currentIndex = availableThemes.indexOf(currentTheme);

        // Calculate the index of the next theme, wrapping around
        const nextIndex = (currentIndex + 1) % availableThemes.length;
        const nextTheme = availableThemes[nextIndex];

        applyTheme(nextTheme); // Apply the next theme
    });
} else {
    console.warn("Theme toggle button (#theme-toggle-btn) not found!");
}

// Load the initial theme when the DOM is ready
loadAndApplyInitialTheme();

// --- End Section 9 ---
    // --- End Section 9 ---


    // --- SECTION 10: Voice Command Handling ---
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition;
    let recognitionActive = false;

    function updateVoiceButtonState(state) { if (!voiceInputBtn) return; const icon = voiceInputBtn.querySelector('i'); if (!icon) return; voiceInputBtn.disabled = (state !== 'idle'); if (state === 'listening') { voiceInputBtn.classList.remove('btn-primary', 'btn-secondary'); voiceInputBtn.classList.add('btn-danger'); icon.className = 'bi bi-record-circle-fill'; if(taskInput) taskInput.placeholder = "Listening..."; } else if (state === 'processing') { voiceInputBtn.classList.remove('btn-primary', 'btn-danger'); voiceInputBtn.classList.add('btn-secondary'); icon.className = 'bi bi-hourglass-split'; if(taskInput) taskInput.placeholder = "Processing voice input..."; } else { /* idle */ voiceInputBtn.classList.remove('btn-danger', 'btn-secondary'); voiceInputBtn.classList.add('btn-primary'); icon.className = 'bi bi-mic-fill'; if(taskInput) taskInput.placeholder = "What needs doing? Or use the mic!"; recognitionActive = false; } }
    function resetVoiceButton() { updateVoiceButtonState('idle'); }

    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = false; recognition.lang = 'en-US'; recognition.interimResults = false; recognition.maxAlternatives = 1;

        if (voiceInputBtn) {
            voiceInputBtn.addEventListener('click', () => {
                if (recognitionActive) { console.log("Recognition already active, stopping."); recognition.stop(); return; }
                try { recognition.start(); recognitionActive = true; } catch(e) { console.error("Voice recognition start error:", e.message); alert(`Could not start voice recognition: ${e.message}`); resetVoiceButton(); }
            });

            // --- Recognition Event Handlers ---
            recognition.onstart = () => { console.log("Voice recognition started."); updateVoiceButtonState('listening'); };

            // UPDATED onresult with logging and SINGULAR checks
            recognition.onresult = (event) => {
                console.log("--- Voice Result Received ---");
                updateVoiceButtonState('processing');
                let transcript = "";
                if (event.results && event.results.length > 0 && event.results[0].length > 0) {
                     transcript = event.results[0][0].transcript.trim();
                     console.log('Raw Transcript:', `"${transcript}"`, 'Confidence:', event.results[0][0].confidence);
                } else { console.warn("Received result event with no transcript."); return; }
                if (transcript === "") { console.log("Empty transcript received."); if(taskInput) taskInput.placeholder = "Didn't catch that."; return; }

                const lowerCaseTranscript = transcript.toLowerCase().trim(); // Trim again for safety
                console.log('Checking Command against:', `"${lowerCaseTranscript}"`);

                // --- Command Parsing Logic ---
                if (lowerCaseTranscript.includes('motivate') || lowerCaseTranscript.includes('motivation')) {
                    console.log(">>> Entering: Motivate block");
                    triggerGeneralMotivation();
                }
                else if (lowerCaseTranscript.includes('clear completed') || lowerCaseTranscript.includes('remove finished') || lowerCaseTranscript.includes('delete completed')) {
                     console.log(">>> Entering: Clear Completed block");
                    if (!taskList) { console.error("Task list not found for clearing."); return; }
                    const completedTasks = taskList.querySelectorAll('li.task-item.task-completed');
                    if (completedTasks.length === 0) { console.log("No completed tasks found to clear."); if(taskInput) taskInput.placeholder = "No completed tasks to clear."; }
                    else {
                         console.log(`Found ${completedTasks.length} completed tasks. Attempting to clear...`); let clearedCount = 0;
                         completedTasks.forEach(li => { const taskId = li.dataset.taskId; const deleteButton = li.querySelector('.delete-btn'); if (taskId && deleteButton) { handleDeleteClick(deleteButton, taskId, true); clearedCount++; } else { console.warn(`Could not find taskId/delete button for completed task:`, li); } });
                         console.log(`Initiated clearing for ${clearedCount} tasks.`); if(taskInput) taskInput.placeholder = `Cleared ${clearedCount} completed tasks.`;
                     }
                }
                else if ( // Read tasks command block - Added singular checks
                    lowerCaseTranscript.includes('read tasks') ||        // Plural
                    lowerCaseTranscript.includes('read my tasks') ||    // Plural
                    lowerCaseTranscript.includes('what are my tasks') || // Plural
                    lowerCaseTranscript.includes('list tasks') ||       // Plural
                    lowerCaseTranscript.includes('read task') ||         // Singular
                    lowerCaseTranscript.includes('read my task') ||     // Singular (Observed!)
                    lowerCaseTranscript.includes('what are my task') ||  // Singular (Observed!)
                    lowerCaseTranscript.includes('list task')          // Singular
                 ) {
                    console.log(">>> Entering: Read Tasks block");
                    readTasksAloud();
                }
                // --- Add more commands here above the final else ---
                else { // Default: Add Task
                     console.log(">>> Entering: Default Add Task block");
                    console.log("Voice Input Defaulting To: Adding Task - ", `"${transcript}"`);
                    submitNewTask(transcript);
                }
                console.log("--- Command Parsing Complete ---");
            }; // End of onresult


            recognition.onspeechend = () => { console.log("Speech end detected."); /* Stop might be automatic */ };
            recognition.onnomatch = () => { console.warn("Speech not recognized (no match)."); if(taskInput) taskInput.placeholder = "Couldn't understand that."; };
            recognition.onerror = (event) => {
                console.error(`Speech Recognition Error: ${event.error}`); let msg = `Speech Error: ${event.error}`;
                if (event.error === 'no-speech') msg = "No speech detected."; else if (event.error === 'audio-capture') msg = "Microphone error."; else if (event.error === 'not-allowed') msg = "Microphone permission denied."; else if (event.error === 'network') msg = "Network error during recognition.";
                if(taskInput) taskInput.placeholder = msg; alert(msg + " Please check microphone/permissions.");
            };
            recognition.onend = () => { console.log("Voice recognition ended."); resetVoiceButton(); recognitionActive = false; }; // Reset state/flag

        } else { console.warn("Voice input button (#voiceInputBtn) not found!"); }
    } else {
        console.warn("SpeechRecognition API not supported by this browser.");
        if (voiceInputBtn) { voiceInputBtn.disabled = true; voiceInputBtn.title = "Voice input not supported"; voiceInputBtn.innerHTML = '<i class="bi bi-mic-mute-fill"></i>'; }
    }
    // --- End Section 10 ---

}); // End of DOMContentLoaded listener