/*
 * JSON Modal Viewer — standalone, dependency-free, ES5.
 *
 * Nhúng:
 *   <link rel="stylesheet" href="json-modal.css">
 *   <script src="json-modal.js"></script>
 *
 * API:
 *   JsonModal.show(input)
 *   JsonModal.show(input, "Tiêu đề")
 *   JsonModal.show(input, { title: "...", fileName: "..." })
 *   JsonModal.close()
 *   JsonModal.isOpen()
 *
 *   input   : chuỗi JSON hoặc object/giá trị JS bất kỳ (tự stringify)
 *   title   : tiêu đề hiển thị trên header modal
 *   fileName: tên gốc file khi tải; file tải ra là
 *             "<fileName>_<Date.now()>.json" (mặc định "data")
 *
 * Tính năng:
 *   - Format + tô màu JSON (key/string/number/boolean/null)
 *   - Hiển thị lỗi khi JSON không hợp lệ
 *   - Nút "Tải xuống" tải nội dung đã format (disable khi JSON lỗi)
 *   - Đóng bằng nút ×, nút Đóng, phím ESC hoặc click nền
 *
 * Alias tương thích:
 *   window.showJsonModal(input, title|options)
 *   window.closeJsonModal()
 *
 * Modal markup được tạo tự động vào <body> ở lần dùng đầu tiên. Nếu trang
 * đã có sẵn element #jsonModal theo đúng cấu trúc thì sẽ dùng lại element đó.
 */
(function (global) {
    "use strict";

    var modal = null;
    var modalTitle = null;
    var modalContent = null;
    var closeIcon = null;
    var closeButton = null;
    var downloadButton = null;
    var previousBodyOverflow = "";
    var previousFocusedElement = null;
    var keydownBound = false;

    /* Nội dung JSON hợp lệ hiện tại + tên file tải xuống. */
    var currentJsonText = "";
    var currentFileName = "data.json";

    function setText(element, text) {
        if (typeof element.textContent !== "undefined") {
            element.textContent = text;
        } else {
            element.innerText = text;
        }
    }

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    }

    function highlightJson(json) {
        var safeJson = escapeHtml(json);
        return safeJson.replace(
            /("(\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
            function (value) {
                var className = "json-number";
                if (/^"/.test(value)) {
                    className = /:$/.test(value) ? "json-key" : "json-string";
                } else if (/^(true|false)$/.test(value)) {
                    className = "json-boolean";
                } else if (/^null$/.test(value)) {
                    className = "json-null";
                }
                return '<span class="' + className + '">' + value + "</span>";
            }
        );
    }

    function isModalOpen() {
        return modal && (" " + modal.className + " ").indexOf(" is-open ") !== -1;
    }

    function addOpenClass() {
        if (!isModalOpen()) {
            modal.className += " is-open";
        }
    }

    function removeOpenClass() {
        modal.className = modal.className.replace(/\s*\bis-open\b/g, "");
    }

    /* Build the modal DOM once and cache element references. */
    function ensureModal() {
        if (modal) {
            return;
        }

        modal = document.getElementById("jsonModal");

        if (!modal) {
            modal = document.createElement("div");
            modal.id = "jsonModal";
            modal.className = "json-modal";
            modal.setAttribute("aria-hidden", "true");
            modal.innerHTML =
                '<div class="json-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="jsonModalTitle">' +
                    '<header class="json-modal-header">' +
                        '<div class="json-modal-heading">' +
                            '<span class="status-dot" aria-hidden="true"></span>' +
                            '<h2 id="jsonModalTitle" class="json-modal-title">JSON Viewer</h2>' +
                        '</div>' +
                        '<button id="closeJsonModalIcon" class="icon-button" type="button" aria-label="Đóng modal">&times;</button>' +
                    '</header>' +
                    '<div class="json-modal-body">' +
                        '<pre id="jsonModalContent" class="json-content"></pre>' +
                    '</div>' +
                    '<footer class="json-modal-footer">' +
                        '<span>Nhấn ESC để đóng</span>' +
                        '<div class="json-modal-footer-actions">' +
                            '<button id="downloadJsonModalButton" class="secondary-button" type="button">Tải xuống</button>' +
                            '<button id="closeJsonModalButton" class="secondary-button" type="button">Đóng</button>' +
                        '</div>' +
                    '</footer>' +
                '</div>';
            document.body.appendChild(modal);
        }

        modalTitle = modal.querySelector("#jsonModalTitle") || modal.querySelector(".json-modal-title");
        modalContent = modal.querySelector("#jsonModalContent") || modal.querySelector(".json-content");
        closeIcon = modal.querySelector("#closeJsonModalIcon") || modal.querySelector(".icon-button");
        closeButton = modal.querySelector("#closeJsonModalButton");
        downloadButton = modal.querySelector("#downloadJsonModalButton");

        if (closeIcon) { closeIcon.onclick = close; }
        if (closeButton) { closeButton.onclick = close; }
        if (downloadButton) { downloadButton.onclick = downloadJson; }

        modal.onclick = function (event) {
            event = event || global.event;
            if (event.target === modal) {
                close();
            }
        };

        if (!keydownBound) {
            bindKeydown();
            keydownBound = true;
        }
    }

    function bindKeydown() {
        var existing = document.onkeydown;
        document.onkeydown = function (event) {
            event = event || global.event;
            if (isModalOpen() && (event.keyCode === 27 || event.key === "Escape")) {
                close();
            }
            if (typeof existing === "function") {
                return existing.call(this, event);
            }
        };
    }

    /* Public: show.
       show(input)
       show(input, "Tiêu đề")
       show(input, { title: "...", fileName: "ekyc" })  */
    function show(input, titleOrOptions) {
        ensureModal();

        var options = titleOrOptions && typeof titleOrOptions === "object"
            ? titleOrOptions
            : { title: titleOrOptions };

        var jsonString = typeof input === "string"
            ? input
            : safeStringify(input);

        if (!isModalOpen()) {
            previousBodyOverflow = document.body.style.overflow;
            previousFocusedElement = document.activeElement;
        }

        setText(modalTitle, options.title || "JSON Viewer");
        modalContent.className = "json-content";
        currentFileName = options.fileName || "data";
        currentJsonText = "";
        if (downloadButton) {
            downloadButton.disabled = true;
        }

        try {
            var parsed = JSON.parse(jsonString);
            var formatted = JSON.stringify(parsed, null, 2);
            modalContent.innerHTML = highlightJson(formatted);
            currentJsonText = formatted;
            if (downloadButton) {
                downloadButton.disabled = false;
            }
        } catch (error) {
            modalContent.className = "json-content json-error";
            setText(
                modalContent,
                "JSON không hợp lệ:\n\n" + (error.message || String(error))
            );
        }

        addOpenClass();
        modal.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
        if (closeIcon) { closeIcon.focus(); }
    }

    /* Tải xuống hiện tại: <fileName>_<timestamp>.json */
    function downloadJson() {
        if (!currentJsonText) {
            return;
        }
        var name = currentFileName + "_" + Date.now() + ".json";
        var blob = new Blob([currentJsonText], { type: "application/json" });
        var url = URL.createObjectURL(blob);
        var link = document.createElement("a");
        link.href = url;
        link.download = name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        /* Giải phóng sau một nhịp để trình duyệt kịp tải. */
        global.setTimeout(function () {
            URL.revokeObjectURL(url);
        }, 0);
    }

    function safeStringify(value) {
        try {
            return JSON.stringify(value);
        } catch (error) {
            return String(value);
        }
    }

    /* Public: close. */
    function close() {
        if (!isModalOpen()) {
            return;
        }
        removeOpenClass();
        modal.setAttribute("aria-hidden", "true");
        document.body.style.overflow = previousBodyOverflow;
        if (previousFocusedElement && previousFocusedElement.focus) {
            previousFocusedElement.focus();
        }
    }

    var JsonModal = {
        show: show,
        close: close,
        isOpen: isModalOpen
    };

    /* Exports */
    global.JsonModal = JsonModal;
})(this);
