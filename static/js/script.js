// Paste this complete and corrected code into your script.js file

document.addEventListener('DOMContentLoaded', () => {

    // --- SECTION 1: Get References to Elements ---
    const addTaskForm = document.getElementById('addTaskForm');
    const taskInput = document.getElementById('taskInput');
    const taskList = document.getElementById('taskList'); // UL element
    const themeToggleButton = document.getElementById('theme-toggle-btn');
    const aiModalElement = document.getElementById('aiResponseModal');
    const modalTitleSpan = document.getElementById('modalTaskTitle');
    const modalBody = document.getElementById('aiResponseModalBody');
    const noTasksMsg = document.getElementById('noTasksMessage');
    const voiceInputBtn = document.getElementById('voiceInputBtn');
    const globalMotivateButton = document.getElementById('global-motivate-button');
    // --- End Section 1 ---

    // --- SECTION: Utility Functions ---
    function escapeHTML(str) { // CORRECTED MAPPINGS
        if (typeof str !== 'string') return '';
        return str.replace(/[&<>"']/g, function (match) {
            return {
                '&': '&', // Fixed
                '<': '<',  // Fixed
                '>': '>',  // Fixed
                '"': '"', // Fixed
                "'": '&#39;' // Fixed
            }[match];
        });
    }

    function getLevenshteinDistance(a, b) { // Levenshtein Distance Calculator
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
        if (!taskContent || taskContent.trim() === "") { console.warn("Empty task submission blocked."); showToast("Task cannot be empty.", "warning"); return; }
        const submitButton = addTaskForm ? addTaskForm.querySelector('button[type="submit"]') : null;
        const originalButtonHTML = submitButton ? submitButton.innerHTML : 'Add Task';
        if(submitButton) { submitButton.disabled = true; submitButton.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Adding...`; }
        if(voiceInputBtn) voiceInputBtn.disabled = true;
        try {
            const response = await fetch("/add", { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: taskContent }) });
            const result = await response.json();
            if (response.status === 201 && result.success && result.task) {
                addNewTaskToList(result.task);
                if(taskInput) taskInput.value = '';
                const shortName = result.task.content.substring(0, 30) + (result.task.content.length > 30 ? '...' : '');
                showToast(`Task "${shortName}" added!`, 'success');
            } else { throw new Error(result.error || `Server Error: ${response.status}`); }
        } catch (error) {
            console.error('Error adding task:', error.message);
            showToast(`Error adding task: ${error.message}`, 'danger');
        } finally {
            if(submitButton) { submitButton.disabled = false; submitButton.innerHTML = originalButtonHTML; }
            if(voiceInputBtn && !recognitionActive) { resetVoiceButton(); }
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
        taskList.addEventListener('click', (event) => {
            const button = event.target.closest('button'); if (!button) return;
            const listItem = button.closest('.task-item'); if (!listItem) return;
            const taskId = listItem.dataset.taskId;
            if (button.classList.contains('ask-ai-btn')) { handleAskAiClick(button, button.dataset.taskText); }
            else if (button.classList.contains('delete-btn')) { handleDeleteClick(button, taskId); }
        });
        taskList.addEventListener('change', (event) => {
            const checkbox = event.target;
            if (checkbox.classList.contains('task-checkbox') && checkbox.type === 'checkbox') {
                const listItem = checkbox.closest('.task-item'); if (!listItem) return;
                handleCheckboxChange(checkbox, listItem.dataset.taskId);
            }
        });
    } else { console.error("Task list (#taskList) element not found!"); }
    // --- End Section 4 ---


    // --- SECTION 5: Helper Function to Create and Add New Task LI Element ---
    function addNewTaskToList(task) { // Cleaned version (removed temporary logs)
        if (!taskList || !task || typeof task.id === 'undefined') { console.error("Invalid data for addNewTaskToList", task); return; }
        console.log("Adding task to list:", task); // Keep one log here maybe
        const li = document.createElement('li');
        li.className = `list-group-item task-item d-flex justify-content-between align-items-center ${task.completed ? 'task-completed' : ''}`; li.dataset.taskId = task.id;
        const taskContentDiv = document.createElement('div'); taskContentDiv.className = 'd-flex align-items-center flex-grow-1 task-content-container';
        const checkbox = document.createElement('input'); checkbox.type='checkbox'; checkbox.className='form-check-input task-checkbox'; checkbox.checked=task.completed; checkbox.id=`task-${task.id}`;
        const span = document.createElement('span'); span.className='task-text'; span.textContent = task.content;
        taskContentDiv.appendChild(checkbox); taskContentDiv.appendChild(span);
        const buttonDiv = document.createElement('div'); buttonDiv.className='task-buttons btn-group';
        const aiButton = document.createElement('button'); aiButton.type="button"; aiButton.className='ask-ai-btn btn btn-outline-info btn-sm'; aiButton.title="Ask AI"; aiButton.dataset.taskText=task.content; aiButton.innerHTML='<i class="bi bi-magic"></i><span class="visually-hidden">AI</span>';
        const deleteButton = document.createElement('button'); deleteButton.type="button"; deleteButton.className='delete-btn btn btn-outline-danger btn-sm'; deleteButton.title="Delete"; deleteButton.innerHTML='<i class="bi bi-trash"></i><span class="visually-hidden">Del</span>';
        buttonDiv.appendChild(aiButton); buttonDiv.appendChild(deleteButton);
        li.appendChild(taskContentDiv); li.appendChild(buttonDiv);
        taskList.appendChild(li);
        requestAnimationFrame(() => { li.classList.add('task-fade-in'); });
        li.addEventListener('animationend', () => { li.classList.remove('task-fade-in'); }, { once: true });
        if (noTasksMsg && noTasksMsg.style.display !== 'none') { noTasksMsg.style.display = 'none'; } // Hide empty msg if needed
    }
    // --- End Section 5 ---


    // --- SECTION 6: Task Action Handlers ---
    async function handleAskAiClick(button, taskText) {
        if (!taskText || taskText.trim() === "") { showToast("Cannot ask AI about empty task.", "warning"); return; }
        button.disabled = true; const originalContent = button.innerHTML; button.innerHTML = `<span class="spinner-border spinner-border-sm"></span>`;
        try {
            const response = await fetch('/ask-ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ task_text: taskText }) });
            const result = await response.json(); if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
            displayModalResponse(`AI: "${escapeHTML(taskText)}"`, result, true, ""); // escapeHTML usage check needed - ok here
        } catch (error) { console.error('Error (Ask AI):', error.message); displayModalResponse("AI Error", { error: error.message }, false, "AI Service:"); }
        finally { button.disabled = false; button.innerHTML = originalContent; }
    }

    async function handleCheckboxChange(checkbox, taskId) {
        const isCompleted = checkbox.checked; const listItem = checkbox.closest('.task-item'); if (!listItem) return;
        listItem.classList.toggle('task-completed', isCompleted); // Optimistic UI
        try {
            const response = await fetch(`/complete/${taskId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
            const result = await response.json(); if (!response.ok || !result.success) { throw new Error(result.error || 'Server error'); }
            checkbox.checked = result.completed_status; listItem.classList.toggle('task-completed', result.completed_status); // Ensure correct final state
            console.log(`Task ${taskId} completion: ${result.completed_status}`);
            // Optional: showToast(`Task marked as ${result.completed_status ? 'complete' : 'incomplete'}.`, 'info');
        } catch (error) {
            console.error('Error updating task:', error.message);
            checkbox.checked = !isCompleted; listItem.classList.toggle('task-completed', !isCompleted); // Rollback UI
            showToast(`Error updating task: ${error.message}`, 'danger');
        }
    }

    async function handleDeleteClick(button, taskId, skipConfirmation = false) {
        const listItem = button.closest('.task-item'); // Get listItem early to find text
        const taskText = listItem?.querySelector('.task-text')?.textContent || `Task ${taskId}`; // Get text for confirmation/toast
        const shortName = taskText.substring(0, 30) + (taskText.length > 30 ? '...' : '');

        if (!skipConfirmation && !confirm(`Delete "${shortName}"?`)) { return; } // Use short name in confirm

        button.disabled = true; const originalContent = button.innerHTML; button.innerHTML = `<span class="spinner-border spinner-border-sm"></span>`;
        if (!listItem) { console.error(`List item ${taskId} not found for delete`); showToast(`Error: Could not find task element to delete.`, 'danger'); if (!skipConfirmation) { button.disabled = false; button.innerHTML = originalContent; } return; }

        try {
            const response = await fetch(`/delete/${taskId}`, { method: 'POST' });
            const result = await response.json(); if (!response.ok || !result.success) { throw new Error(result.error || 'Server error'); }
            console.log(`Task ${taskId} delete confirmed (SkipConfirm: ${skipConfirmation}).`);
            showToast(`Task "${shortName}" deleted.`, 'info'); // Toast on success confirmation
            listItem.classList.add('task-fade-out');
            listItem.addEventListener('animationend', () => {
                 listItem.remove(); console.log(`Task ${taskId} removed from DOM.`);
                 if (taskList && taskList.children.length === 0 && noTasksMsg) { // Check for actual tasks, not just #noTasksMsg
                      const hasTaskItems = taskList.querySelector('li.task-item') !== null;
                      if (!hasTaskItems) noTasksMsg.style.display = 'block';
                 }
             }, { once: true });
        } catch (error) {
            console.error(`Error deleting task ${taskId}:`, error.message);
            if (!skipConfirmation) { // Only show error UI if user initiated directly
                 showToast(`Error deleting "${shortName}": ${error.message}`, 'danger');
                 button.disabled = false; button.innerHTML = originalContent; // Restore button if interactively failed
            }
             // No UI restore for background voice failures needed
        }
    }
    // --- End Section 6 ---


    // --- SECTION 7: UI Helpers (Motivation, Modal, Speech Synth, Toast) ---
    async function triggerGeneralMotivation() { /* ... Motivation logic ... */
        const modalInstance = bootstrap.Modal.getOrCreateInstance(aiModalElement); if (modalTitleSpan) modalTitleSpan.textContent = 'Getting Motivation...'; if (modalBody) modalBody.innerHTML = '<div class="d-flex justify-content-center"><div class="spinner-border"></div></div>'; modalInstance.show();
        const originalButtonHTML = globalMotivateButton ? globalMotivateButton.innerHTML : null; if(globalMotivateButton) { globalMotivateButton.disabled = true; globalMotivateButton.innerHTML = `<span class="spinner-border spinner-border-sm"></span>...`; }
        try {
            const response = await fetch('/motivate-me', { method: 'POST' }); const result = await response.json(); if (!response.ok) { throw new Error(result.error || `HTTP ${response.status}`); }
            if (modalTitleSpan) modalTitleSpan.textContent = 'A Dose of Motivation!';
            if (modalBody) { modalBody.innerHTML = `<blockquote class="blockquote mb-0"><p>${escapeHTML(result.motivation)}</p></blockquote>`; } // escapeHTML applied here
        } catch (error) { console.error('Error motivation:', error.message); if (modalTitleSpan) modalTitleSpan.textContent = 'Error'; if (modalBody) modalBody.textContent = `Sorry: ${error.message}`; showToast(`Motivation error: ${error.message}`, 'warning');
        } finally { if(globalMotivateButton && originalButtonHTML) { globalMotivateButton.disabled = false; globalMotivateButton.innerHTML = originalButtonHTML; } }
    }
    if (globalMotivateButton) { globalMotivateButton.addEventListener('click', triggerGeneralMotivation); } else { console.log("Global motivate button not found."); }

    function displayModalResponse(title, result, isOk, errorPrefix, responseKey = 'details') { /* ... Modal display ... */
        if (!modalTitleSpan || !modalBody || !aiModalElement) { console.error("Modal elements missing!"); showToast(`UI Error: Cannot display modal`, 'danger'); return; }
        if (typeof bootstrap === 'undefined' || !bootstrap.Modal) { console.error("Bootstrap Modal missing!"); showToast(`UI Error: Modal component failed`, 'danger'); return; }
        const aiModal = bootstrap.Modal.getOrCreateInstance(aiModalElement); modalTitleSpan.textContent = title;
        if (isOk) { modalBody.innerHTML = escapeHTML(result[responseKey] || "").replace(/\n/g, '<br>'); } // escapeHTML applied here
        else { modalBody.textContent = `${errorPrefix} ${result.error || 'Unknown Error'}`; } aiModal.show();
    }

    const supportsSpeechSynthesis = 'speechSynthesis' in window; if (!supportsSpeechSynthesis) { console.warn("Speech Synthesis not supported."); }
    function readTasksAloud() { /* ... Read tasks logic ... */
        if (!supportsSpeechSynthesis) { showToast("Speech synthesis not supported by browser.", "warning"); return; }
        if (!taskList) { console.error("Task list missing for reading."); return; } const taskItems = taskList.querySelectorAll('li.task-item'); let textToSpeak = ""; let taskCount = taskItems.length;
        if (taskCount === 0) { textToSpeak = "You have no tasks."; } else { let tasksStrings = []; taskItems.forEach((item)=>{ const txt=item.querySelector('.task-text'); const comp=item.classList.contains('task-completed'); if(txt){ const pfx=comp?"Completed: ":""; tasksStrings.push(`${pfx}${txt.textContent}.`); }}); const pl=taskCount===1?"task":"tasks"; textToSpeak=`Okay, ${taskCount} ${pl}. ${tasksStrings.join(' ')}`; }
        console.log("Speaking:", `"${textToSpeak}"`); window.speechSynthesis.cancel(); const utt = new SpeechSynthesisUtterance(textToSpeak); utt.lang = 'en-US'; utt.rate = 1.0; utt.pitch = 1.0;
        utt.onerror = (e) => { console.error("Speech Error:", e.error); showToast(`Speech error: ${e.error}`, 'danger'); }; window.speechSynthesis.speak(utt);
    }

    // --- Toast Notification Setup ---
    const liveToastElement = document.getElementById('liveToast');
    const toastBodyElement = document.getElementById('toastBody');
    const toastTitleElement = document.getElementById('toastTitle');
    const toastTimestampElement = document.getElementById('toastTimestamp');
    let liveToastInstance = null;
    if (typeof bootstrap !== 'undefined' && liveToastElement) { liveToastInstance = bootstrap.Toast.getOrCreateInstance(liveToastElement, { delay: 3500 }); }
    else if (!liveToastElement) { console.warn("Toast element #liveToast not found."); }
    else { console.warn("Bootstrap object not found."); }

    function showToast(message, type = 'default', title = '') {
        if (!liveToastInstance || !toastBodyElement || !toastTitleElement || !toastTimestampElement) { console.warn("Toast not ready:", message); return; }
        if (!title) { switch (type) { case 'success': title='Success'; break; case 'danger': title='Error'; break; case 'warning': title='Warning'; break; case 'info': title='Info'; break; default: title='Notification'; } }
        const colorClasses = { success: 'text-bg-success', danger: 'text-bg-danger', warning: 'text-bg-warning', info: 'text-bg-info', default: '' };
        liveToastElement.classList.remove(...Object.values(colorClasses).filter(c => c)); // Remove only non-empty classes
        const toastClass = colorClasses[type] || '';
        if (toastClass) { liveToastElement.classList.add(toastClass); }
        toastTitleElement.textContent = title; toastBodyElement.textContent = message;
        toastTimestampElement.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        console.log(`Toast (${type}): ${message}`); liveToastInstance.show();
    }
    // --- End Section 7 ---


    // --- SECTION 8: Initial UI Setup ---
    document.querySelectorAll('.task-checkbox').forEach(cb => { const li = cb.closest('.task-item'); if (li) { li.classList.toggle('task-completed', cb.checked); } });
    if (taskList && noTasksMsg) { // CORRECTED Empty state visibility check
        const hasTaskItems = taskList.querySelector('li.task-item') !== null;
        noTasksMsg.style.display = hasTaskItems ? 'none' : 'block';
        console.log("Initial load check:", hasTaskItems ? "Tasks found" : "No tasks found");
    }
    // --- End Section 8 ---


    // --- SECTION 9: Theme Toggling Logic ---
    const availableThemes = ['light', 'dark', 'forest', 'ocean'];
    const themeIcons = { 'light': '<i class="bi bi-sun-fill"></i>', 'dark': '<i class="bi bi-moon-stars-fill"></i>', 'forest': '<i class="bi bi-tree-fill"></i>', 'ocean': '<i class="bi bi-water"></i>' };
    function applyTheme(themeName) { /* ... */ if (!availableThemes.includes(themeName)) { console.warn(`Theme "${themeName}" invalid.`); themeName = 'light'; } console.log(`Theme: ${themeName}`); document.documentElement.dataset.theme = themeName; if (themeToggleButton) { const icon=themeIcons[themeName]||''; const disp=themeName.charAt(0).toUpperCase()+themeName.slice(1); themeToggleButton.innerHTML=`${icon} ${disp}`; themeToggleButton.title=`Theme: ${disp}`; } try {localStorage.setItem('theme', themeName);} catch (e){console.error("LS Error:", e);} }
    function loadAndApplyInitialTheme() { /* ... */ let preferred='light'; try {const stored=localStorage.getItem('theme'); if (stored&&availableThemes.includes(stored)){preferred=stored;console.log(`LS Theme: ${preferred}`);} else if(stored){console.warn(`Invalid LS theme "${stored}"`);}} catch(e){console.error("LS Error:",e);} applyTheme(preferred); }
    if (themeToggleButton) { themeToggleButton.addEventListener('click', () => { const curr = document.documentElement.dataset.theme||'light'; const idx=availableThemes.indexOf(curr); const next=(idx+1)%availableThemes.length; applyTheme(availableThemes[next]); }); } else { console.warn("Theme button missing!"); } loadAndApplyInitialTheme();
    // --- End Section 9 ---


    // --- SECTION 10: Voice Command Handling ---
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition;
    let recognitionActive = false;
    function updateVoiceButtonState(state) { /* ... */ if (!voiceInputBtn) return; const icon=voiceInputBtn.querySelector('i'); if (!icon) return; voiceInputBtn.disabled=(state !== 'idle'); if (state==='listening'){voiceInputBtn.classList.remove('btn-primary','btn-secondary');voiceInputBtn.classList.add('btn-danger'); icon.className='bi bi-record-circle-fill'; if(taskInput)taskInput.placeholder="Listening...";} else if (state==='processing'){voiceInputBtn.classList.remove('btn-primary','btn-danger'); voiceInputBtn.classList.add('btn-secondary'); icon.className='bi bi-hourglass-split'; if(taskInput)taskInput.placeholder="Processing...";} else {/*idle*/ voiceInputBtn.classList.remove('btn-danger','btn-secondary'); voiceInputBtn.classList.add('btn-primary'); icon.className='bi bi-mic-fill'; if(taskInput)taskInput.placeholder="Add task or use mic..."; recognitionActive=false;} }
    function resetVoiceButton() { updateVoiceButtonState('idle'); }

    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = false; recognition.lang = 'en-US'; recognition.interimResults = false; recognition.maxAlternatives = 1;

        if (voiceInputBtn) {
            voiceInputBtn.addEventListener('click', () => { /* ... */ if (recognitionActive) { console.log("Stopping recognition."); recognition.stop(); return; } try { recognition.start(); recognitionActive = true; } catch(e) { console.error("Voice start error:", e.message); showToast(`Mic error: ${e.message}`, 'danger'); resetVoiceButton(); } });

            recognition.onstart = () => { console.log("Voice Rec Start."); updateVoiceButtonState('listening'); };

            recognition.onresult = (event) => { // Keep debugging logs for voice for now
                console.log("--- Voice Result Received ---");
                console.log("Full event object:", event); console.log("event.results structure:", event.results);
                updateVoiceButtonState('processing');
                let transcript = "";
                try { if (event.results && event.results.length > 0 && event.results[0] && event.results[0].length > 0 && typeof event.results[0][0].transcript === 'string') { transcript = event.results[0][0].transcript.trim(); console.log('Raw:', `"${transcript}"`, 'Conf:', event.results[0][0].confidence); } else { console.warn("Transcript structure unexpected.", event.results); return; }
                } catch (error) { console.error("Err getting transcript:", error); console.error("Event:", event); return; }
                if (transcript === "") { console.log("Empty transcript."); if(taskInput) taskInput.placeholder = "Didn't catch that."; return; }

                const lowerCaseTranscript = transcript.toLowerCase().trim();
                console.log('Checking Cmd:', `"${lowerCaseTranscript}"`);

                if (lowerCaseTranscript.includes('motivate')) { console.log(">>> Motivate"); triggerGeneralMotivation(); }
                else if (lowerCaseTranscript.includes('clear completed') || lowerCaseTranscript.includes('remove finished')) {
                    console.log(">>> Clear Completed"); if (!taskList) { return; } const completed = taskList.querySelectorAll('li.task-item.task-completed');
                    if (completed.length === 0) { console.log("No completed."); if(taskInput) taskInput.placeholder="No completed tasks."; showToast("No completed tasks to clear.", 'info'); }
                    else { let count=0; completed.forEach(li=>{const id=li.dataset.taskId; const btn=li.querySelector('.delete-btn'); if(id&&btn){handleDeleteClick(btn,id,true); count++;}}); console.log(`Clear init for ${count}.`); showToast(`Cleared ${count} completed task(s).`, 'success'); } // Toast added
                }
                else if (lowerCaseTranscript.includes('read task') || lowerCaseTranscript.includes('read tasks') || lowerCaseTranscript.includes('what are my task') || lowerCaseTranscript.includes('list task')) { console.log(">>> Read Tasks"); readTasksAloud(); }
                else if (lowerCaseTranscript.startsWith('delete task ') || lowerCaseTranscript.startsWith('remove task ')) {
                    console.log(">>> Delete Specific"); let identifier=""; if(lowerCaseTranscript.startsWith('delete task ')){identifier=lowerCaseTranscript.substring(12).trim();} else {identifier=lowerCaseTranscript.substring(12).trim();} console.log(`Identifier: "${identifier}"`);
                    if (identifier===""){console.log("No task specified."); if(taskInput) taskInput.placeholder="Which task?"; showToast("Please specify which task to delete.", "warning");}
                    else if(!taskList){console.error("Task list missing."); showToast("UI Error: Task list not found.", "danger");}
                    else{ let minDist=Infinity; let bestMatch=null; const items=taskList.querySelectorAll('li.task-item'); items.forEach(item=>{const txtEl=item.querySelector('.task-text');if(txtEl){const taskTxt=txtEl.textContent.trim().toLowerCase(); const dist=getLevenshteinDistance(identifier,taskTxt); console.log(`Cmp:"${identifier}" vs "${taskTxt}"=${dist}`); if(dist<minDist){minDist=dist; bestMatch=item;}}}); const THRESH=3; const MIN_LEN=3;
                    if (identifier.length<MIN_LEN){console.log("Identifier too short."); showToast("Task name too short to match reliably.", "warning");}
                    else if(bestMatch&&minDist<=THRESH){ const id=bestMatch.dataset.taskId; const txt=bestMatch.querySelector('.task-text').textContent; const btn=bestMatch.querySelector('.delete-btn'); if(id&&btn){ console.log(`Match:"${txt}" (ID:${id}, Dist:${minDist}). Deleting.`); /* Toast handled by handleDeleteClick */ handleDeleteClick(btn, id, true); } else { console.error("Match found but missing id/btn", bestMatch); showToast("Error deleting matched task.", "danger"); } }
                    else { console.log(`No match for "${identifier}". Min dist: ${minDist}`); showToast(`Couldn't find task like "${identifier}".`, 'warning'); } // Toast added
                    }
                }
                else { console.log(">>> Default Add"); console.log("Default:", `"${transcript}"`); submitNewTask(transcript); } // Toast handled by submitNewTask
                console.log("--- Cmd Parse End ---");
            };

            recognition.onspeechend = () => { console.log("Speech end detected."); };
            recognition.onnomatch = () => { console.warn("Speech no match."); if(taskInput) taskInput.placeholder = "Didn't understand."; };
            recognition.onerror = (event) => { console.error(`Speech Error: ${event.error}`); let msg = `Speech Error: ${event.error}`; if (event.error==='no-speech') msg="No speech."; else if(event.error==='audio-capture')msg="Mic error."; else if(event.error==='not-allowed')msg="Permission denied."; else if(event.error==='network')msg="Network error."; if(taskInput) taskInput.placeholder = msg; showToast(msg, 'danger'); };
            recognition.onend = () => { console.log("Voice Rec End."); resetVoiceButton(); recognitionActive = false; };

        } else { console.warn("Voice button not found!"); }
    } else { /* ... API not supported ... */ }
    // --- End Section 10 ---

}); // End of DOMContentLoaded listener