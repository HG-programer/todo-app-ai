// Paste this complete and cleaned code into your script.js file

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

    // --- SECTION: Utility Functions --- // Moved Levenshtein here
    function escapeHTML(str) { // Defined ONCE
        if (typeof str !== 'string') return '';
        return str.replace(/[&<>"']/g, function (match) {
            return { '&': '&', '<': '<', '>': '>', '"': '"', "'": '\'' }[match];
        });
    }

    function getLevenshteinDistance(a, b) { // Defined ONCE
        const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));
        for (let i = 0; i <= a.length; i += 1) { matrix[0][i] = i; }
        for (let j = 0; j <= b.length; j += 1) { matrix[j][0] = j; }
        for (let j = 1; j <= b.length; j += 1) {
            for (let i = 1; i <= a.length; i += 1) {
                const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
                matrix[j][i] = Math.min( matrix[j][i - 1] + 1, matrix[j - 1][i] + 1, matrix[j - 1][i - 1] + indicator );
            }
        }
        return matrix[b.length][a.length];
    }
    // --- End Utility Functions Section ---


    // --- SECTION 2: Core Task Submission Logic ---
    async function submitNewTask(taskContent) {
        // ... (code is likely okay, keep as is) ...
        if (!taskContent || taskContent.trim() === "") { console.warn("Attempted to submit empty task."); alert("Task content cannot be empty."); return; }
        const submitButton = addTaskForm ? addTaskForm.querySelector('button[type="submit"]') : null;
        const originalButtonHTML = submitButton ? submitButton.innerHTML : 'Add Task';
        if(submitButton) { submitButton.disabled = true; submitButton.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Adding...`; }
        if(voiceInputBtn) voiceInputBtn.disabled = true;
        try {
            const response = await fetch("/add", { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: taskContent }) });
            const result = await response.json();
            if (response.status === 201 && result.success && result.task) {
                // --- ADDED LOG: Confirm success condition ---
                console.log("submitNewTask success condition met. Task data:", result.task);
               addNewTaskToList(result.task); // Add visually
               if(taskInput) taskInput.value = ''; // Clear input field only on success
               console.log(`Task "${taskContent}" add flow initiated in UI.`); // Renamed log
           } else {
               // Log if the condition failed but response was kinda okay
               console.error("Task add request okay, but success/task data invalid.", "Status:", response.status, "Result:", result);
               throw new Error(result.error || `Invalid success response: ${response.status}`); // Throw error to be caught below
           }
       } catch (error) { // ... (error handling) ...
            console.error('Error adding task:', error.message);
            alert(`Error adding task: ${error.message}`);
        } finally {
            if(submitButton) { submitButton.disabled = false; submitButton.innerHTML = originalButtonHTML; }
            if(voiceInputBtn && (!recognitionActive)) { resetVoiceButton(); }
        }
    }
    // --- End Section 2 ---


    // --- SECTION 3: Add Task Form Event Listener ---
    if (addTaskForm) {
        addTaskForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const taskText = taskInput.value.trim();
            submitNewTask(taskText);
        });
    } else { console.error("Add Task form (#addTaskForm) not found!"); }
    // --- End Section 3 ---


    // --- SECTION 4: Task List Event Delegation ---
    if (taskList) {
        // ... (event listeners for click/change - keep as is) ...
        taskList.addEventListener('click', (event) => { /* ... Ask AI / Delete */
            const target = event.target;
            const button = target.closest('button');
            if (!button) return;
            const listItem = button.closest('.task-item');
            if (!listItem) return;
            const taskId = listItem.dataset.taskId;

            if (button.classList.contains('ask-ai-btn')) {
                const taskText = button.dataset.taskText;
                handleAskAiClick(button, taskText);
            } else if (button.classList.contains('delete-btn')) {
                handleDeleteClick(button, taskId);
            }
        });
        taskList.addEventListener('change', (event) => { /* ... Complete checkbox */
             const target = event.target;
            if (target.classList.contains('task-checkbox') && target.type === 'checkbox') {
                const checkbox = target;
                const listItem = checkbox.closest('.task-item');
                if (!listItem) return;
                const taskId = listItem.dataset.taskId;
                handleCheckboxChange(checkbox, taskId);
            }
        });
    } else { console.error("Task list (#taskList) element not found!"); }
    // --- End Section 4 ---

       // --- SECTION 5: Helper Function to Create and Add New Task LI Element ---
function addNewTaskToList(task) {
    // --- ADDED LOG: Check if function is called and task data is okay ---
    console.log(">>> addNewTaskToList called with task:", task);

    // --- ADDED LOG: Verify taskList element exists ---
    console.log("taskList element:", taskList);

    if (!taskList || !task || typeof task.id === 'undefined') {
        console.error("Cannot add task to list - invalid input or list element missing.", task);
        return;
    }
    const li = document.createElement('li');
    li.className = `list-group-item task-item d-flex justify-content-between align-items-center ${task.completed ? 'task-completed' : ''}`;
    li.dataset.taskId = task.id;

    // ... (rest of element creation: taskContentDiv, checkbox, span, buttonDiv, buttons) ...
    const taskContentDiv = document.createElement('div');
    taskContentDiv.className = 'd-flex align-items-center flex-grow-1 task-content-container';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'form-check-input task-checkbox';
    checkbox.checked = task.completed;
    checkbox.id = `task-${task.id}`;
    const span = document.createElement('span');
    span.className = 'task-text';
    span.textContent = task.content;
    taskContentDiv.appendChild(checkbox); taskContentDiv.appendChild(span);

    const buttonDiv = document.createElement('div'); buttonDiv.className = 'task-buttons btn-group';
    const aiButton = document.createElement('button'); aiButton.type="button"; aiButton.className='ask-ai-btn btn btn-outline-info btn-sm'; aiButton.title="Ask AI"; aiButton.dataset.taskText=task.content; aiButton.innerHTML='<i class="bi bi-magic"></i><span class="visually-hidden">AI</span>';
    const deleteButton = document.createElement('button'); deleteButton.type="button"; deleteButton.className='delete-btn btn btn-outline-danger btn-sm'; deleteButton.title="Delete"; deleteButton.innerHTML='<i class="bi bi-trash"></i><span class="visually-hidden">Del</span>';
    buttonDiv.appendChild(aiButton); buttonDiv.appendChild(deleteButton);


    li.appendChild(taskContentDiv);
    li.appendChild(buttonDiv);

    // --- ADDED LOG: Check the constructed LI element before appending ---
    console.log("Constructed LI element:", li);

    // --- ADDED LOG: Confirm appending is about to happen ---
    console.log("Attempting to append LI to taskList...");
    taskList.appendChild(li);
    // --- ADDED LOG: Confirm appending finished ---
    console.log("LI appended.");


    requestAnimationFrame(() => {
        // --- ADDED LOG: Confirm animation class addition ---
         console.log("Applying fade-in animation class.");
         li.classList.add('task-fade-in');
    });

    // ... (rest of function - animation listener, noTasksMsg hide) ...
    if (noTasksMsg && noTasksMsg.style.display !== 'none') { noTasksMsg.style.display = 'none'; }

     console.log("<<< addNewTaskToList finished."); // Added Log
}
// --- End Section 5 ---


    // --- SECTION 6: Task Action Handlers ---
    async function handleAskAiClick(button, taskText) { /* ... keep as is ... */
        if (!taskText || taskText.trim() === "") { alert("Cannot ask AI about an empty task."); return; }
        button.disabled = true; const originalContent = button.innerHTML; button.innerHTML = `<span class="spinner-border spinner-border-sm"></span>`;
        try {
            const response = await fetch('/ask-ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ task_text: taskText }) });
            const result = await response.json(); if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
            displayModalResponse(`AI: "${escapeHTML(taskText)}"`, result, true, "");
        } catch (error) { console.error('Error (Ask AI):', error.message); displayModalResponse("AI Error", { error: error.message }, false, "AI Service:"); }
        finally { button.disabled = false; button.innerHTML = originalContent; }
    }
    async function handleCheckboxChange(checkbox, taskId) { /* ... keep as is ... */
        const isCompleted = checkbox.checked; const listItem = checkbox.closest('.task-item'); if (!listItem) return;
        listItem.classList.toggle('task-completed', isCompleted); // Optimistic
        try {
            const response = await fetch(`/complete/${taskId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
            const result = await response.json(); if (!response.ok || !result.success) { throw new Error(result.error || 'Server error'); }
            checkbox.checked = result.completed_status; listItem.classList.toggle('task-completed', result.completed_status);
            console.log(`Task ${taskId} completed: ${result.completed_status}`);
        } catch (error) {
            console.error('Error updating task:', error.message);
            checkbox.checked = !isCompleted; listItem.classList.toggle('task-completed', !isCompleted); // Rollback
            alert(`Error updating task: ${error.message}`);
        }
    }
    async function handleDeleteClick(button, taskId, skipConfirmation = false) { /* ... keep as is ... */
        if (!skipConfirmation && !confirm(`Are you sure you want to delete this task?`)) { return; }
        button.disabled = true; const originalContent = button.innerHTML; button.innerHTML = `<span class="spinner-border spinner-border-sm"></span>`;
        const listItem = button.closest('.task-item'); if (!listItem) { console.error(`List item ${taskId} not found`); if (!skipConfirmation) { button.disabled = false; button.innerHTML = originalContent; } return; }
        try {
            const response = await fetch(`/delete/${taskId}`, { method: 'POST' });
            const result = await response.json(); if (!response.ok || !result.success) { throw new Error(result.error || 'Server error'); }
            console.log(`Task ${taskId} deleted (SkipConfirm: ${skipConfirmation}).`);
            listItem.classList.add('task-fade-out');
            listItem.addEventListener('animationend', () => { listItem.remove(); console.log(`Task ${taskId} removed.`); if (taskList && taskList.children.length === 0 && noTasksMsg) { noTasksMsg.style.display = 'block'; } }, { once: true });
        } catch (error) {
            console.error(`Error deleting task ${taskId}:`, error.message);
            if (!skipConfirmation) { alert(`Error deleting task: ${error.message}`); button.disabled = false; button.innerHTML = originalContent; }
        }
    }
    // --- End Section 6 ---


    // --- SECTION 7: General Motivation & Modal Display & Speech Synth ---
    async function triggerGeneralMotivation() { /* ... keep as is ... */
        const modalInstance = bootstrap.Modal.getOrCreateInstance(aiModalElement); if (modalTitleSpan) modalTitleSpan.textContent = 'Getting Motivation...'; if (modalBody) modalBody.innerHTML = '<div class="d-flex justify-content-center"><div class="spinner-border"></div></div>'; modalInstance.show();
        const originalButtonHTML = globalMotivateButton ? globalMotivateButton.innerHTML : null; if(globalMotivateButton) { globalMotivateButton.disabled = true; globalMotivateButton.innerHTML = `<span class="spinner-border spinner-border-sm"></span>...`; }
        try {
            const response = await fetch('/motivate-me', { method: 'POST' }); const result = await response.json(); if (!response.ok) { throw new Error(result.error || `HTTP ${response.status}`); }
            if (modalTitleSpan) modalTitleSpan.textContent = 'A Dose of Motivation!'; if (modalBody) { modalBody.innerHTML = `<blockquote class="blockquote mb-0"><p>${escapeHTML(result.motivation)}</p></blockquote>`; }
        } catch (error) { console.error('Error motivation:', error.message); if (modalTitleSpan) modalTitleSpan.textContent = 'Error'; if (modalBody) modalBody.textContent = `Sorry: ${error.message}`;
        } finally { if(globalMotivateButton && originalButtonHTML) { globalMotivateButton.disabled = false; globalMotivateButton.innerHTML = originalButtonHTML; } }
    }
    if (globalMotivateButton) { globalMotivateButton.addEventListener('click', triggerGeneralMotivation); } else { console.log("Global motivate button not found."); }

    function displayModalResponse(title, result, isOk, errorPrefix, responseKey = 'details') { /* ... keep as is ... */
         if (!modalTitleSpan || !modalBody || !aiModalElement) { console.error("Modal elements missing!"); alert(isOk ? (result[responseKey] || "") : `${errorPrefix} ${result.error || 'UI Error.'}`); return; }
         if (typeof bootstrap === 'undefined' || !bootstrap.Modal) { console.error("Bootstrap Modal not loaded!"); alert("Modal error."); return; }
        const aiModal = bootstrap.Modal.getOrCreateInstance(aiModalElement); modalTitleSpan.textContent = title;
        if (isOk) { modalBody.innerHTML = escapeHTML(result[responseKey] || "").replace(/\n/g, '<br>'); } else { modalBody.textContent = `${errorPrefix} ${result.error || 'Unknown'}`; } aiModal.show();
    }

    const supportsSpeechSynthesis = 'speechSynthesis' in window; if (!supportsSpeechSynthesis) { console.warn("Speech Synthesis not supported."); }
    function readTasksAloud() { /* ... keep as is ... */
        if (!supportsSpeechSynthesis) { alert("Browser cannot read tasks aloud."); return; } if (!taskList) { console.error("Task list missing."); return; }
        const taskItems = taskList.querySelectorAll('li.task-item'); let textToSpeak = ""; let taskCount = taskItems.length;
        if (taskCount === 0) { textToSpeak = "You have no tasks."; }
        else {
            let tasksStrings = []; taskItems.forEach((item) => { const txt = item.querySelector('.task-text'); const comp = item.classList.contains('task-completed'); if (txt) { const pfx = comp ? "Completed: " : ""; tasksStrings.push(`${pfx}${txt.textContent}.`); } });
            const pl = taskCount === 1 ? "task" : "tasks"; textToSpeak = `Okay, ${taskCount} ${pl}. ${tasksStrings.join(' ')}`;
        }
        console.log("Speaking:", `"${textToSpeak}"`); window.speechSynthesis.cancel(); const utt = new SpeechSynthesisUtterance(textToSpeak);
        utt.lang = 'en-US'; utt.rate = 1.0; utt.pitch = 1.0; utt.onstart = () => console.log("Speech start..."); utt.onend = () => console.log("Speech end."); utt.onerror = (e) => { console.error("Speech Error:", e.error); alert(`Speech error: ${e.error}`); };
        window.speechSynthesis.speak(utt);
    }
    // --- End Section 7 ---


    // --- SECTION 8: Initial UI Setup ---
    document.querySelectorAll('.task-checkbox').forEach(cb => { const li = cb.closest('.task-item'); if (li) { li.classList.toggle('task-completed', cb.checked); } });
    if (taskList && taskList.children.length === 0 && noTasksMsg) { noTasksMsg.style.display = 'block'; } else if (noTasksMsg) { noTasksMsg.style.display = 'none'; }
    // --- End Section 8 ---


    // --- SECTION 9: Theme Toggling Logic ---  // Defined ONCE
    const availableThemes = ['light', 'dark', 'forest', 'ocean'];
    const themeIcons = { 'light': '<i class="bi bi-sun-fill"></i>', 'dark': '<i class="bi bi-moon-stars-fill"></i>', 'forest': '<i class="bi bi-tree-fill"></i>', 'ocean': '<i class="bi bi-water"></i>' };
    function applyTheme(themeName) {
        if (!availableThemes.includes(themeName)) { console.warn(`Theme "${themeName}" invalid. Defaulting.`); themeName = 'light'; }
        console.log(`Applying theme: ${themeName}`); document.documentElement.dataset.theme = themeName;
        if (themeToggleButton) { const iconHTML = themeIcons[themeName] || ''; const displayName = themeName.charAt(0).toUpperCase() + themeName.slice(1); themeToggleButton.innerHTML = `${iconHTML} ${displayName}`; themeToggleButton.title = `Theme: ${displayName}`; }
        try { localStorage.setItem('theme', themeName); } catch (e) { console.error("LS Error:", e); }
    }
    function loadAndApplyInitialTheme() {
        let preferredTheme = 'light'; try { const stored = localStorage.getItem('theme'); if (stored && availableThemes.includes(stored)) { preferredTheme = stored; console.log(`LS Theme: ${preferredTheme}`); } else if (stored) { console.warn(`Invalid LS theme "${stored}"`); } } catch (e) { console.error("LS Error:", e); }
        // Optional system pref check commented out below
        /* if (preferredTheme === 'light' && !localStorage.getItem('theme')) { const darkQuery = window.matchMedia('(prefers-color-scheme: dark)'); if (darkQuery.matches && availableThemes.includes('dark')) { preferredTheme = 'dark'; console.log("Sys Pref: dark"); } } */
        applyTheme(preferredTheme);
    }
    if (themeToggleButton) { themeToggleButton.addEventListener('click', () => { const current = document.documentElement.dataset.theme || 'light'; const curIdx = availableThemes.indexOf(current); const nextIdx = (curIdx + 1) % availableThemes.length; applyTheme(availableThemes[nextIdx]); }); } else { console.warn("Theme button not found!"); }
    loadAndApplyInitialTheme();
    // --- End Section 9 ---


    // --- SECTION 10: Voice Command Handling ---
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition;
    let recognitionActive = false;

    function updateVoiceButtonState(state) { /* ... keep as is ... */
        if (!voiceInputBtn) return; const icon = voiceInputBtn.querySelector('i'); if (!icon) return; voiceInputBtn.disabled = (state !== 'idle');
        if (state === 'listening') { voiceInputBtn.classList.remove('btn-primary','btn-secondary'); voiceInputBtn.classList.add('btn-danger'); icon.className = 'bi bi-record-circle-fill'; if(taskInput) taskInput.placeholder = "Listening..."; }
        else if (state === 'processing') { voiceInputBtn.classList.remove('btn-primary','btn-danger'); voiceInputBtn.classList.add('btn-secondary'); icon.className = 'bi bi-hourglass-split'; if(taskInput) taskInput.placeholder = "Processing..."; }
        else { /* idle */ voiceInputBtn.classList.remove('btn-danger','btn-secondary'); voiceInputBtn.classList.add('btn-primary'); icon.className = 'bi bi-mic-fill'; if(taskInput) taskInput.placeholder = "Add task or use mic..."; recognitionActive = false; }
    }
    function resetVoiceButton() { updateVoiceButtonState('idle'); }

    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = false; recognition.lang = 'en-US'; recognition.interimResults = false; recognition.maxAlternatives = 1;

        if (voiceInputBtn) {
            voiceInputBtn.addEventListener('click', () => { /* ... keep as is ... */
                if (recognitionActive) { console.log("Stopping active recognition."); recognition.stop(); return; }
                try { recognition.start(); recognitionActive = true; } catch(e) { console.error("Voice start error:", e.message); alert(`Mic error: ${e.message}`); resetVoiceButton(); }
            });

            // --- Recognition Event Handlers ---
             recognition.onstart = () => { console.log("Voice Rec Start."); updateVoiceButtonState('listening'); };

            // CORRECTED/FINAL onresult with PRE-LOGGING
            recognition.onresult = (event) => {
                console.log("--- Voice Result Received ---");

                // Log the event structure FIRST
                console.log("Full event object:", event);
                console.log("event.results structure:", event.results);

                updateVoiceButtonState('processing'); // Processing...

                let transcript = "";
                // Extract transcript safely
                try {
                    // Check structure carefully based on logs
                    if (event.results && event.results.length > 0 &&
                        event.results[0] && event.results[0].length > 0 &&
                        typeof event.results[0][0].transcript === 'string') // Check type
                    {
                         transcript = event.results[0][0].transcript.trim();
                         console.log('Raw Transcript:', `"${transcript}"`, 'Confidence:', event.results[0][0].confidence);
                    } else {
                         console.warn("Transcript structure not as expected. See 'event.results structure' log above.", event.results);
                         return; // Cannot proceed without transcript
                    }
                } catch (error) {
                     console.error("Error accessing transcript:", error);
                     console.error("Problematic event:", event); // Log again if access fails
                     return;
                }

                if (transcript === "") {
                    console.log("Empty transcript."); if(taskInput) taskInput.placeholder = "Didn't catch that.";
                    return;
                }

                // Command Parsing Logic
                const lowerCaseTranscript = transcript.toLowerCase().trim();
                console.log('Checking Command:', `"${lowerCaseTranscript}"`);

                if (lowerCaseTranscript.includes('motivate')) {
                    console.log(">>> Entering: Motivate"); triggerGeneralMotivation();
                }
                else if (lowerCaseTranscript.includes('clear completed') || lowerCaseTranscript.includes('remove finished')) {
                     console.log(">>> Entering: Clear Completed"); if (!taskList) { return; } const completed = taskList.querySelectorAll('li.task-item.task-completed');
                     if (completed.length === 0) { console.log("No completed tasks."); if(taskInput) taskInput.placeholder="No completed tasks.";}
                     else { console.log(`Clearing ${completed.length} tasks...`); let count = 0; completed.forEach(li => { const id=li.dataset.taskId; const btn=li.querySelector('.delete-btn'); if (id&&btn){ handleDeleteClick(btn, id, true); count++;}}); console.log(`Clear initiated for ${count}.`); if(taskInput) taskInput.placeholder = `Cleared ${count} tasks.`;}
                }
                else if (lowerCaseTranscript.includes('read task') || lowerCaseTranscript.includes('read tasks') || lowerCaseTranscript.includes('what are my task') || lowerCaseTranscript.includes('list task')) {
                    console.log(">>> Entering: Read Tasks"); readTasksAloud();
                }
                else if (lowerCaseTranscript.startsWith('delete task ') || lowerCaseTranscript.startsWith('remove task ')) {
                    console.log(">>> Entering: Delete Specific Task"); let identifier = "";
                    if (lowerCaseTranscript.startsWith('delete task ')) { identifier = lowerCaseTranscript.substring('delete task '.length).trim(); }
                    else { identifier = lowerCaseTranscript.substring('remove task '.length).trim(); }
                    console.log(`Identifier: "${identifier}"`);
                    if (identifier === "") { console.log("No task specified."); if(taskInput) taskInput.placeholder = "Which task?"; }
                    else if (!taskList) { console.error("Task list missing."); }
                    else {
                        let minDist = Infinity; let bestMatch = null; const items = taskList.querySelectorAll('li.task-item');
                        items.forEach(item => { const txtEl = item.querySelector('.task-text'); if (txtEl) { const taskTxt = txtEl.textContent.trim().toLowerCase(); const dist = getLevenshteinDistance(identifier, taskTxt); console.log(`Compare "${identifier}" vs "${taskTxt}" = ${dist}`); if (dist < minDist) { minDist = dist; bestMatch = item; } }});
                        const THRESHOLD = 3; const MIN_LEN = 3;
                        if (identifier.length < MIN_LEN) { console.log("Identifier too short."); if(taskInput) taskInput.placeholder="Task name too short."; }
                        else if (bestMatch && minDist <= THRESHOLD) {
                             const id = bestMatch.dataset.taskId; const txt = bestMatch.querySelector('.task-text').textContent; const btn = bestMatch.querySelector('.delete-btn');
                             if (id && btn) { console.log(`Match found: "${txt}" (ID: ${id}, Dist: ${minDist}). Deleting.`); if(taskInput) taskInput.placeholder=`Deleting "${txt}"...`; handleDeleteClick(btn, id, true); }
                             else { console.error("Match found but no ID/button:", bestMatch); if(taskInput) taskInput.placeholder="Error deleting."; }
                        } else { console.log(`No match for "${identifier}". Min dist: ${minDist}`); if(taskInput) taskInput.placeholder=`No task like "${identifier}".`; }
                    }
                }
                else {
                    console.log(">>> Entering: Default Add Task"); console.log("Defaulting to Add:", `"${transcript}"`);
                    submitNewTask(transcript);
                }
                console.log("--- Command Parsing Complete ---");
            }; // End of onresult (defined only ONCE)


             recognition.onspeechend = () => { console.log("Speech end detected."); };
             recognition.onnomatch = () => { console.warn("Speech no match."); if(taskInput) taskInput.placeholder = "Didn't understand."; };
             recognition.onerror = (event) => { /* ... keep error handling as is ... */
                console.error(`Speech Error: ${event.error}`); let msg = `Speech Error: ${event.error}`; if (event.error === 'no-speech') msg="No speech."; else if(event.error==='audio-capture')msg="Mic error."; else if(event.error==='not-allowed')msg="Permission denied."; else if(event.error==='network')msg="Network error."; if(taskInput) taskInput.placeholder = msg; alert(msg);
            };
             recognition.onend = () => { console.log("Voice Rec End."); resetVoiceButton(); recognitionActive = false; };

        } else { console.warn("Voice input button not found!"); }
    } else { /* ... API not supported logic ... */
        console.warn("SpeechRecognition API not supported."); if (voiceInputBtn) { voiceInputBtn.disabled = true; voiceInputBtn.title="Voice not supported"; voiceInputBtn.innerHTML='<i class="bi bi-mic-mute-fill"></i>'; }
    }
    // --- End Section 10 ---

}); // End of DOMContentLoaded listener