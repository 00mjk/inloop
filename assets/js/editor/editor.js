// Load data attributes, which are rendered into the script tag
const script = document.getElementById("editor-script");
const SAVE_CHECKPOINT_URL = script.getAttribute("data-save-checkpoint-url");
const GET_LAST_CHECKPOINT_URL = script.getAttribute("data-get-last-checkpoint-url");
const CSRF_TOKEN = script.getAttribute("data-csrf-token");
const SOLUTIONS_EDITOR_URL = script.getAttribute("data-solutions-editor-url");
const SOLUTIONS_LIST_URL = script.getAttribute("data-solutions-list-url");
const SYNTAX_CHECK_URL = script.getAttribute("data-syntax-check-url");

const CURRENT_SUBMITS_DATA_KEY = "data-current-submissions";
const MAX_SUBMITS_DATA_KEY = "data-submission-limit";
const NO_SUBMISSION_LIMIT = -1;

const htmlIds ={
  EDITOR_TABBAR_FILES: "editor-tabbar-files",
  EDITOR: "editor-content",
  BTN_SAVE: "toolbar-btn--save",
  BTN_ADD_FILE: "toolbar-btn--newfile",
  BTN_SUBMIT: "toolbar-btn--submit",
  BTN_RENAME_FILE: "editor-tabbar-btn--rename",
  BTN_DELETE_FILE: "editor-tabbar-btn--delete",
  BTN_SYNTAX: "toolbar-btn--syntax",
  BTN_SWITCH_TO_EDITOR: "toolbar-switch-btn--editor",
  BTN_SWITCH_TO_UPLOAD: "toolbar-switch-btn--manual",
  DEADLINE: "task-deadline",
  MANUAL_UPLOAD_INPUT: "manual-upload-file-input",
  MANUAL_UPLOAD_FORM: "manual-upload-form",
  TOOLBAR_BUTTONS_RIGHT: "toolbar-buttons--right",
  CONSOLE_CONTAINER: "console",
  CONSOLE_CONTENT: "console-content",
  CONSOLE_HIDE_BUTTON: "console-btn--hide"
}

const msgs = {
  try_again_later: "Please try again later.",
  duplicate_filename:
    'A file with the name "%filename%" already exists.\nPlease choose another filename.',
  invalid_filename:
    '"%filename%" is not a valid Java filename.\nMake sure to add the correct file suffix (.java).',
  choose_filename: "Please enter a name for your new file.",
  edit_filename: 'Renaming "%filename%".\nPlease enter a new file name.',
  delete_file_confirmation: 'Are you sure you want to delete "%filename%"?',
  missing_es6_support:
    "Your browser does not support ECMAScript 6. Please update or change your browser to use the editor.",
  error_loading_files: "Error occured: Could not load saved files from server.",
  error_save: "Could not save files.\n%message%",
  deadline_expired: "Deadline expired",
  not_implemented_yet: "This functionality has not been implemented yet.",
  syntax_check_successful: "Syntax check successful. No errors detected.",
  syntax_check_failed: "Syntax check failed. %amount% errors/warnings detected.",
  error_checking_syntax: "Could not check syntax. Please try again later.",
  error_submit: "Submission failed.\n%message%",
  error_save_before_submit:
    "Submission failed. Could not save files before submitting.\n%message%",
  error_unknown: "Unknown error"
};

const EMPTY_STRING_SHA1 = "da39a3ee5e6b4b0d3255bfef95601890afd80709";

function getString(string, extra) {
  if (extra) {
    return string.replace(/\%.*\%/, extra);
  } else {
    return string;
  }
}

/**
 * Return true if the given name is a valid java filename, otherwise false.
 *
 * @param {string} filename - the filename to check.
 */
function isValidJavaFilename(filename) {
  return /^[A-Za-z0-9_]+\.java$/.test(filename);
}

/**
 * Represents an editor tab for an editor file.
 */
class Tab {
  /**
   * Creates a tab.
   *
   * @constructor
   * @param {number} tabId - The unique id of the tab.
   * @param {File} file - The file to attach to this tab.
   */
  constructor(tabId, file) {
    this.tabId = tabId;
    this.file = file;
    this.tabListContainer = document.getElementById(htmlIds.EDITOR_TABBAR_FILES);
  }

  /**
   * Gets and inserts tab html.
   */
  build() {
    const newTab = document.createElement("li");
    newTab.innerText = this.file.fileName;
    newTab.id = `file-tab-${this.tabId}`;
    newTab.addEventListener("click", () => tabBar.switchToTab(this.tabId));
    this.tabDomElement = newTab;
    this.tabListContainer.appendChild(newTab);
  }

  /**
   * Removes the rendered tab html from the DOM.
   */
  destroy() {
    this.tabDomElement.remove();
    fileBuilder.destroy(this.file);
  }

  /**
   * Changes the tab label to a given name.
   * Should be called on any filename changes
   * of the file coupled to the tab.
   *
   * @param {string} name - The new tab label.
   */
  rename(name) {
    this.tabDomElement.innerText = name;
  }

  /**
   * Changes the style of the tab.
   *
   * @param {boolean} active - True to make tab appear as active, false as inactive.
   */
  appearAsActive(active) {
    if (active) {
      this.tabDomElement.classList.add("active");
    } else {
      this.tabDomElement.classList.remove("active");
    }
  }
}

/**
 * Represents a hash based comparator for files.
 */
class HashComparator {
  /**
   * Creates a hash comparator.
   *
   * @constructor
   * @param {string} hash - The MD5 hash of the files as an initial value.
   */
  constructor(hash, hasChangesCallback) {
    this.rusha = new Rusha();
    this.hash = hash;
    this.hasChangesCallback = hasChangesCallback;
  }

  /**
   * Updates the MD5 hash.
   *
   * @param {string} hash - The new MD5 hash.
   */
  updateHash(hash) {
    this.hash = hash;
  }

  /**
   * Computes the MD5 hash of the given files by
   * file content and file name concatenation.
   *
   * @param {Array} files - The files on which the MD5 hash should be computed.
   * @returns {string} - The computed MD5 hash.
   */
  computeHash(files) {
    let concatenatedContents = "";
    for (let f of files) {
      concatenatedContents += f.fileContent;
      concatenatedContents += f.fileName;
    }
    return this.rusha.digest(concatenatedContents);
  }

  /**
   * Compute the MD5 hash of the given files and compare
   * it with the stored (class attribute) hash.
   *
   * @param {Array} files - The files on which the MD5 hash should be computed.
   * @returns {boolean} - Returns true if and only if the given files are unchanged.
   */
  lookForChanges(files) {
    let equal = this.computeHash(files) === this.hash;
    this.hasChangesCallback(!equal);
    return equal;
  }
}

/**
 * Represents an editor file.
 */
class File {
  /**
   * Compares two files by name. Provides a comparator function for alphabetic sorting.
   *
   * @param {File} a - The first file.
   * @param {File} b - The second file.
   * @returns {number} - The file name based comparator output.
   */
  static compare(a, b) {
    if (a.fileName < b.fileName) return -1;
    if (a.fileName > b.fileName) return 1;
    return 0;
  }

  /**
   * Creates an editor file with a given file name and given file contents.
   *
   * @constructor
   * @param {string} fileName - The file name.
   * @param {string} fileContent - The file content.
   */
  constructor(fileName, fileContent) {
    this.fileName = fileName;
    this.fileContent = fileContent;
  }
}

/**
 * Represents a builder for files.
 */
class FileBuilder {
  /**
   * Creates a file builder.
   *
   * @constructor
   * @param {Array} files - The initial files.
   */
  constructor(files) {
    this.files = files;
  }

  /**
   * Checks, if a given file name exists already.
   *
   * @param {string} fileName - The file name.
   * @returns {boolean} - Returns true if the file exists already.
   */
  contains(fileName) {
    for (let file of this.files) {
      if (file.fileName.toLowerCase() === fileName.toLowerCase()) {
        return true;
      }
    }
    return false;
  }

  /**
   * Builds a new file.
   *
   * @param {string} fileName - The file name.
   * @param {string} fileContent - The file contents.
   * @returns {File} - The built file.
   */
  build(fileName, fileContent) {
    let f = new File(fileName, fileContent);
    this.files.push(f);
    return f;
  }

  /**
   * Removes a given file.
   *
   * @param {File} file - The file to remove.
   */
  destroy(file) {
    this.files = this.files.filter((f) => f.fileName !== file.fileName);
  }
}

/**
 * Represents a tab bar containing tabs.
 */
class TabBar {
  /**
   * Creates a new tab bar.
   *
   * @constructor
   * @param {Array} files - The initial files.
   */
  constructor(files) {
    this.tabs = [];
    this.tabId = 0;
    this.editor = new InloopEditor();
    this.editor.addOnChangeListener(function () {
      hashComparator.lookForChanges(fileBuilder.files);
    });
    this.renameFileButton = document.getElementById(htmlIds.BTN_RENAME_FILE);
    this.deleteFileButton = document.getElementById(htmlIds.BTN_DELETE_FILE);
    this.renameFileButton.addEventListener("click", () => this.renameFile());
    this.deleteFileButton.addEventListener("click", () => this.deleteFile());
    for (let file of files) {
      this.createNewTab(file);
    }
    this.toggleRenameDeleteButtons();
    this.toggleToolbarSyntaxSubmitButtons();
  }

  /**
   * Creates a new file.
   *
   * Displays a prompt for file name input and
   * creates an additional file tab based on the given file name.
   */
  createNewFile() {
    const fileCreationCallback = (fileName) => {
      if (!isValidJavaFilename(fileName) || fileName.trim() === "") {
        showPrompt(getString(msgs.invalid_filename, fileName), fileCreationCallback, fileName);
        return;
      }
      if (fileBuilder.contains(fileName)) {
        showPrompt(getString(msgs.duplicate_filename, fileName), fileCreationCallback, fileName);
        return;
      }
      const file = fileBuilder.build(fileName, "");
      hashComparator.lookForChanges(fileBuilder.files);
      if (file === undefined) return;
      this.createNewTab(file);
      this.toggleRenameDeleteButtons();
      this.toggleToolbarSyntaxSubmitButtons();
    };
    showPrompt(getString(msgs.choose_filename), fileCreationCallback);
  }

  /**
   * Creates a new tab based on a given file.
   *
   * @param {File} file - The file.
   * @returns {Tab} - The created tab.
   */
  createNewTab(file) {
    let tab = new Tab(++this.tabId, file);
    tab.build();
    this.tabs.push(tab);
    this.switchToTab(tab.tabId);
    return tab;
  }

  /**
   * Switches to a given tab. The given tab appears as active,
   * all other tab appear as inactive. Loads the file, which is
   * attached to the given tab, into the editor view.
   *
   * @param {number} tabId - The id of the tab.
   */
  switchToTab(tabId) {
    this.activeTab && this.activeTab.appearAsActive(false);
    this.activeTab = this.tabs.find((tab) => tab.tabId === tabId);
    this.editor.bind(this.activeTab.file);
    this.activeTab.appearAsActive(true);
    this.editor.focus();
  }

  /**
   * Displays a prompt dialog with input form to rename
   * the selected tab and the file attached to it.
   *
   * @param tabId
   */
  renameFile() {
    const fileEditCallback = (fileName) => {
      if (fileName === this.activeTab.file.fileName) {
        return;
      }
      if (!isValidJavaFilename(fileName) || fileName.trim() === "") {
        showPrompt(getString(msgs.invalid_filename, fileName), fileEditCallback, fileName);
        return;
      }
      if (fileBuilder.contains(fileName)) {
        showPrompt(getString(msgs.duplicate_filename, fileName), fileEditCallback, fileName);
        return;
      }
      this.activeTab.file.fileName = fileName;
      this.activeTab.rename(fileName);
      this.editor.focus();
      hashComparator.lookForChanges(fileBuilder.files);
    };
    showPrompt(
      getString(msgs.edit_filename, this.activeTab.file.fileName),
      fileEditCallback,
      this.activeTab.file.fileName
    );
  }

  /**
   * Displays a confirm dialog and removes
   * the active tab and the file attached to it, if confirmed.
   */
  deleteFile() {
    if (this.activeTab === undefined) return;
    const deleteConfirmationCallback = () => {
      this.activeTab.appearAsActive(false);
      const deletedFileTabIndex = this.tabs.lastIndexOf(this.activeTab);
      this.tabs = this.tabs.filter((tab, i) => tab.tabId !== this.activeTab.tabId);
      this.editor.unbind();
      this.activeTab.destroy();
      hashComparator.lookForChanges(fileBuilder.files);
      if (this.tabs.length > 0) {
        this.switchToTab(
          (this.tabs[deletedFileTabIndex] && this.tabs[deletedFileTabIndex].tabId) ||
            this.tabs[this.tabs.length - 1].tabId
        );
      } else {
        this.activeTab = undefined;
      }
      this.toggleRenameDeleteButtons();
      this.toggleToolbarSyntaxSubmitButtons();
    };
    showConfirmDialog(
      getString(msgs.delete_file_confirmation, this.activeTab.file.fileName),
      deleteConfirmationCallback
    );
  }

  toggleToolbarSyntaxSubmitButtons() {
    const hasFiles = this.tabs.length > 0;
    toolbar.setSubmitButtonEnabled(hasFiles);
    toolbar.setSyntaxButtonEnabled(hasFiles);
  }

  toggleRenameDeleteButtons() {
    const hasNoFiles = this.tabs.length === 0;
    this.renameFileButton.disabled = hasNoFiles;
    this.deleteFileButton.disabled = hasNoFiles;
  }
}

/**
 * Represents the code editor.
 *
 * Serves as a convenience wrapper for the ace.js editor.
 * On initiation, the editor renders the wrapped ace.js editor
 * into the specified html element. To improve performance,
 * there should only be one editor. After initiation, reuse the
 * editor with bind and unbind to edit a given file,
 * instead of creating a new editor every time.
 *
 * @example Usage of the editor:
 * -  Use a {@link Communicator} to fetch the latest checkpoint and its files.
 * -  Use a {@link FileBuilder}, to hold, delete and create files.
 * -  Use a {@link HashComparator} to compare files with a hash.
 * -  Use a {@link TabBar} to hold, delete and create tabs, which each bind to a file.
 * -  The {@link TabBar} creates an {@link Editor} as a servant.
 *    Subsequently, the {@link TabBar} controls binding and unbinding
 *    of the tabs and their corresponding files.
 * -  Update the hash of the {@link HashComparator} with {@link Editor#addOnChangeListener}.
 *    If the hash differs, the HashComparator will handle the visual representation
 *    through its {@link SaveButton}.
 */
class InloopEditor {
  /**
   * Provides the default editor configuration.
   *
   * @returns {Object} - The editor configuration.
   */
  static config() {
    return {
      highlightActiveLine: true,
      highlightSelectedWord: true,
      // Set editor to read only, because it should not be
      // accessed before any files are loaded or when no files
      // exist yet. There should be at least one file before the
      // editor accepts any inputs.
      readOnly: true,
      cursorStyle: "ace",
      mergeUndoDeltas: true,
      printMargin: 80,
      theme: "ace/theme/inloop",
      mode: "ace/mode/java",
      newLineMode: "auto",
      tabSize: 4,
      //maxLines: Infinity,
      enableBasicAutocompletion: false,
      enableLiveAutocompletion: false,
      fontFamily: 'Menlo, Monaco, Consolas, "Courier New", monospace',
      fontSize: "10.5pt",
      value: "// Select or create files to continue",
    };
  }

  /**
   * Creates a new editor. Handles creation of the ace.js editor
   * with the default configuration.
   *
   * @constructor
   */
  constructor() {
    this.editor = ace.edit(htmlIds.EDITOR);
    if (this.editor === undefined) {
      return;
    }
    this.editor.setOptions(InloopEditor.config());
  }

  /**
   * Adds a closure function, which is executed when the editor changes.
   *
   * @param {function} closure - The closure function.
   */
  addOnChangeListener(closure) {
    this.onChangeClosure = closure;
  }

  /**
   * Binds a given file to the editor, so that its contents
   * are displayed and changed on editor change.
   *
   * @param {File} file - The file to be bound.
   */
  bind(file) {
    if (this.editor === undefined) return;
    this.editor.setReadOnly(false);
    this.editor.removeAllListeners("change");
    let self = this;
    this.editor.setValue(file.fileContent);
    this.editor.clearSelection();
    this.editor.on("change", function () {
      file.fileContent = self.editor.getValue();
      if (self.onChangeClosure !== undefined) self.onChangeClosure();
    });

    this.editor.resize();
  }

  /**
   * Unbinds the currently bound file from the editor,
   * so that its contents are no longer changed on
   * editor change. Removes all file contents from
   * the editor view.
   */
  unbind() {
    if (this.editor === undefined) return;
    this.editor.removeAllListeners("change");
    this.editor.setValue("");
    this.editor.setReadOnly(true);
    this.editor.off("change");
  }

  focus() {
    document.querySelector(`#${htmlIds.EDITOR} > textarea`).focus();
  }
}

/**
 * Represents an interface to the editor backend.
 */
class Communicator {
  /**
   * Creates a communicator.
   *
   * @constructor
   */
  constructor() {}

  /**
   * Loads files and their MD5 hash from the last checkpoint asynchronously.
   * Returns a promise containing the response's content.
   * If request fails, alert is shown and nothin is returned.
   */
  async getLastCheckpoint() {
    const response = await fetch(GET_LAST_CHECKPOINT_URL);
    if (response.status !== 200) {
      alert(getString(msgs.error_loading_files));
    } else {
      return await response.json();
    }
  }

  /**
   * Saves the current editor state asynchronously.
   * The current editor state is stored as a checkpoint
   * via AJAX in the backend.
   */
  async saveFiles(saveBeforeSubmit = false) {
    const checksum = hashComparator.computeHash(fileBuilder.files);
    const payload = {
      checksum: checksum,
      files: fileBuilder.files.map((file) => {
        return { name: file.fileName, contents: file.fileContent };
      }),
    };
    const requestConfig = {
      method: "POST",
      headers: {
        "X-CSRFToken": CSRF_TOKEN,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    };
    let errorMsg = "";
    const response = await fetch(SAVE_CHECKPOINT_URL, requestConfig).catch(
      (error) => (errorMsg = error)
    );
    if (!response.status || response.status !== 200) {
      showAlert(
        getString(
          saveBeforeSubmit ? msgs.error_save_before_submit : msgs.error_save,
          errorMsg || `${response.status} ${response.statusText}`
        )
      );
      return;
    }
    const data = await response.json();
    if (data.success) {
      hashComparator.updateHash(checksum);
      hashComparator.lookForChanges(fileBuilder.files);
    } else {
      showAlert(getString(saveBeforeSubmit ? msgs.error_save_before_submit : msgs.error_save));
      return;
    }
    if (saveBeforeSubmit) {
      return data;
    }
  }

  /**
   * Saves the given files asynchronously
   * and uploads them to the checker.
   *
   * @param {Array} files - The files to be uploaded.
   */
  async submitFiles(files) {
    const saveResult = await this.saveFiles(true);
    if (!saveResult || !saveResult.success) {
      return;
    }
    const payload = { uploads: {} };
    for (let file of files) {
      payload.uploads[file.fileName] = file.fileContent;
    }
    const requestConfig = {
      method: "POST",
      headers: {
        "X-CSRFToken": CSRF_TOKEN,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    };
    let errorMsg = "";
    const response = await fetch(SOLUTIONS_EDITOR_URL, requestConfig).catch(
      (error) => (errorMsg = error)
    );
    if (!response.status || response.status !== 200) {
      showAlert(
        getString(msgs.error_submit, errorMsg || `${response.status} ${response.statusText}`)
      );
      return;
    }
    return await response.json();
  }

  async checkSyntax() {
    if (!SYNTAX_CHECK_URL) return;
    const payload = {
      files: fileBuilder.files.map((file) => {
        return { name: file.fileName, contents: file.fileContent };
      }),
    };
    const requestConfig = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    };
    const response = await fetch(SYNTAX_CHECK_URL, requestConfig);
    if (response.status !== 200) {
      showAlert(getString(msgs.error_checking_syntax));
      return;
    }
    return await response.json();
  }
}

class SyntaxCheckConsole {
  constructor() {
    this.consoleContainerElement = document.getElementById(htmlIds.CONSOLE_CONTAINER);
    this.consoleContentElement = document.getElementById(htmlIds.CONSOLE_CONTENT);
    this.consoleHideBtn = document.getElementById(htmlIds.CONSOLE_HIDE_BUTTON);
    this.consoleHideBtn.addEventListener("click", () => this.show(false));
  }

  show(show) {
    this.consoleContainerElement.style.display = show ? "block" : "none";
    tabBar.editor.editor.resize();
  }

  createOutputElement(err) {
    const strong = (text) => {
      const strong = document.createElement("strong");
      strong.textContent = text;
      return strong;
    };
    const capitalize = (text) => `${text[0].toUpperCase()}${text.slice(1)}`;
    const p = document.createElement("p");

    let className;
    if (err.type == "error") {
      className = "error";
    } else if (err.type == "warning") {
      className = "warning";
    }

    p.append(strong(capitalize(err.type)));
    p.append(" in line ");
    p.append(strong(err.line));
    p.append(" of ");
    p.append(strong(err.file));
    p.append(": ");
    p.append(document.createTextNode(err.message));

    className && (p.className = `console-content--${className}`);
    return p;
  }

  setContent(checkResult) {
    const p = document.createElement("p");
    while (this.consoleContentElement.firstChild) {
      this.consoleContentElement.removeChild(this.consoleContentElement.firstChild);
    }
    p.textContent = checkResult.success
      ? getString(msgs.syntax_check_successful)
      : getString(msgs.syntax_check_failed, checkResult.diagnostics.length);
    this.consoleContentElement.appendChild(p);
    checkResult.diagnostics.forEach((err) =>
      this.consoleContentElement.appendChild(this.createOutputElement(err))
    );
    tabBar.editor.editor.resize();
  }
}

let fileBuilder;
let hashComparator;
let tabBar;
let toolbar;
let communicator = new Communicator();
let syntaxCheckConsole = new SyntaxCheckConsole();

// Prevent CTRL+S (CMD+S on Mac) and add
// our custom event handler
document.addEventListener(
  "keydown",
  function (e) {
    if (e.keyCode === 83) {
      if (navigator.platform.match("Mac") ? e.metaKey : e.ctrlKey) {
        e.preventDefault();
        communicator.saveFiles();
      }
    }
  },
  false
);
function showPrompt(text, callback, value = "") {
  const result = window.prompt(`${text}\n\n`, value);
  result !== null && callback(result);
}

function showConfirmDialog(text, callback) {
  const result = window.confirm(text);
  result && callback();
}

function showAlert(text) {
  window.alert(text);
}
class Toolbar {
  constructor(
    deadlineId,
    saveButtonId,
    addFileButtonId,
    submitButtonId,
    syntaxButtonId,
    switchToEditorButtonId,
    switchToUploadButtonId
  ) {
    this.deadlineElement = document.getElementById(deadlineId);
    this.saveButton = document.getElementById(saveButtonId);
    this.addFileButton = document.getElementById(addFileButtonId);
    this.submitButton = document.getElementById(submitButtonId);
    this.syntaxButton = document.getElementById(syntaxButtonId);
    this.switchToEditorButton = document.getElementById(switchToEditorButtonId);
    this.switchToUploadButton = document.getElementById(switchToUploadButtonId);
  }

  init() {
    this.saveButton.addEventListener("click", () => communicator.saveFiles());
    this.saveButton.addEventListener("click", () => tabBar.editor.focus());
    this.addFileButton.addEventListener("click", () => tabBar.createNewFile());
    this.submitButton.addEventListener("click", () => this.submitFiles(fileBuilder.files));
    if (this.syntaxButton) {
      this.syntaxButton.addEventListener("click", () => this.checkSyntax());
    }
    this.switchToEditorButton.addEventListener("click", () => this.toggleEditorUpload());
    this.switchToUploadButton.addEventListener("click", () => this.toggleEditorUpload());
    this.switchToEditorButton.disabled = true;
    if (this.deadlineElement !== null) {
      this.endtime = this.deadlineElement.getAttribute("datetime");
      this.startDeadlineCounter();
    }
  }

  submitFiles(files) {
    communicator.submitFiles(files).then((result) => {
      if (!result) {
        return;
      }
      if (result.success) {
        if (result.skip_redirect && result.num_submissions && result.submission_limit) {
          this.updateSubmitButton(result.num_submissions, result.submission_limit);
        } else {
          window.location.assign(SOLUTIONS_LIST_URL);
        }
      } else {
        showAlert(getString(msgs.error_submit, result.reason || msgs.error_unknown));
      }
    });
  }

  updateSubmitButton(currentSubmissions, maxSubmissions) {
    this.submitButton.innerText = `Submit (${currentSubmissions}/${maxSubmissions})`;
    this.submitButton.setAttribute(CURRENT_SUBMITS_DATA_KEY, currentSubmissions);
    this.submitButton.setAttribute(MAX_SUBMITS_DATA_KEY, maxSubmissions);
    this.setSubmitButtonEnabled(currentSubmissions < maxSubmissions);
  }

  checkSyntax() {
    communicator.checkSyntax().then((result) => {
      if (!result) return;
      syntaxCheckConsole.show(true);
      syntaxCheckConsole.setContent(result);
    });
  }

  startDeadlineCounter() {
    this.updateClock();
    if (this.getTimeRemaining().total > 0) {
      this.timeinterval = setInterval(() => this.updateClock(), 1000);
    }
  }

  getTimeRemaining() {
    const total = Date.parse(this.endtime) - new Date();
    const seconds = Math.floor((total / 1000) % 60);
    const minutes = Math.floor((total / 1000 / 60) % 60);
    const hours = Math.floor((total / 1000 / 60 / 60) % 24);
    const days = Math.floor(total / 1000 / 60 / 60 / 24);
    return { total, days, hours, minutes, seconds };
  }

  updateClock() {
    const t = this.getTimeRemaining();
    const format = (number) => (number < 10 ? `0${number}` : number);
    const elem = this.deadlineElement;
    if (t.days > 0) {
      elem.innerText = t.days > 1 ? `${t.days} days` : "1 day";
    } else {
      elem.innerText = format(t.hours) + ":" + format(t.minutes) + ":" + format(t.seconds);
    }
    const fiveMinutesInMillis = 5 * 60 * 1000;
    if (t.total < fiveMinutesInMillis && !elem.classList.contains("deadline-attention")) {
      elem.classList.add("deadline-attention");
    }
    if (t.total <= 0) {
      elem.innerText = getString(msgs.deadline_expired);
      clearInterval(this.timeinterval);
    }
  }

  setSubmitButtonEnabled(enable) {
    const maxSubmissions = parseInt(this.submitButton.getAttribute(MAX_SUBMITS_DATA_KEY));
    const currentSubmissions = parseInt(this.submitButton.getAttribute(CURRENT_SUBMITS_DATA_KEY));
    const maySubmit = maxSubmissions == NO_SUBMISSION_LIMIT || currentSubmissions < maxSubmissions;
    this.submitButton.disabled = !(maySubmit && enable);
  }

  setSyntaxButtonEnabled(enable) {
    this.syntaxButton && (this.syntaxButton.disabled = !enable);
  }

  setSaveButtonEnabled(enable) {
    this.saveButton.disabled = !enable;
  }

  toggleEditorUpload() {
    const isEditor = this.switchToEditorButton.disabled;
    this.switchToEditorButton.disabled = !isEditor;
    this.switchToUploadButton.disabled = isEditor;
    document.getElementById("manual-upload").style.display = isEditor ? "flex" : "none";
    document.getElementById("editor").style.display = isEditor ? "none" : "flex";
    document.getElementById(htmlIds.TOOLBAR_BUTTONS_RIGHT).style.display = isEditor ? "none" : "block";
    if (!isEditor) tabBar.editor.focus();
  }
}

function init() {
  const uploadInputElement = document.getElementById(htmlIds.MANUAL_UPLOAD_INPUT);
  uploadInputElement &&
    uploadInputElement.addEventListener("change", function () {
      document.getElementById(htmlIds.MANUAL_UPLOAD_FORM).submit();
    });

  toolbar = new Toolbar(
    htmlIds.DEADLINE,
    htmlIds.BTN_SAVE,
    htmlIds.BTN_ADD_FILE,
    htmlIds.BTN_SUBMIT,
    htmlIds.BTN_SYNTAX,
    htmlIds.BTN_SWITCH_TO_EDITOR,
    htmlIds.BTN_SWITCH_TO_UPLOAD
  );
  toolbar.init();
  communicator.getLastCheckpoint().then((data) => {
    let files = [];
    let checksum = EMPTY_STRING_SHA1;
    if (data && data.success && data.files) {
      files = data.files.map((file) => new File(file.name, file.contents));
      checksum = data.checksum;
    }
    fileBuilder = new FileBuilder(files);
    hashComparator = new HashComparator(checksum, (hasChanges) =>
      toolbar.setSaveButtonEnabled(hasChanges)
    );
    hashComparator.lookForChanges(files);
    tabBar = new TabBar(files);
  });
}

if (document.readyState != "loading") {
  init();
} else {
  document.addEventListener("DOMContentLoaded", () => init());
}

window.addEventListener("beforeunload", (e) => {
  if (!hashComparator.lookForChanges(fileBuilder.files)) {
    e.preventDefault();
    const confirmationMessage = "";
    e.returnValue = confirmationMessage;
    return confirmationMessage;
  }
});
