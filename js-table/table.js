/*
 * TableRenderer - An ES5 table component with optional Select2 and Datepicker.
 *
 * Features: dynamic columns, dynamic search form, server-side search/sort,
 * pagination, page size change, statistics, loading/empty states, toast
 * notifications, custom cell renderers, event callbacks and responsiveness.
 *
 * Compatibility: ES5 syntax for modern browsers.
 */
(function (global) {
    "use strict";

    /* ----------------------------- Helpers ----------------------------- */

    function isFunction(fn) {
        return typeof fn === "function";
    }

    function isArray(value) {
        return Object.prototype.toString.call(value) === "[object Array]";
    }

    /* Shallow clone of a plain object. */
    function cloneObject(obj) {
        var out = {};
        var key;
        for (key in obj) {
            if (obj.hasOwnProperty(key)) {
                out[key] = obj[key];
            }
        }
        return out;
    }

    /* Escape a value for safe insertion as text into HTML. */
    function escapeHtml(value) {
        if (value === null || typeof value === "undefined") {
            return "";
        }
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    /* Event binding for modern browsers. */
    function on(element, eventName, handler) {
        element.addEventListener(eventName, handler, false);
    }

    function toCssSize(value) {
        if (value === null || typeof value === "undefined" || value === "") {
            return "";
        }
        return typeof value === "number" ? value + "px" : String(value);
    }

    function applyColumnSize(element, column) {
        var width = toCssSize(column.width);
        var minWidth = toCssSize(column.minWidth);
        var maxWidth = toCssSize(column.maxWidth);

        if (width) {
            element.style.width = width;
        }
        if (minWidth) {
            element.style.minWidth = minWidth;
        }
        if (maxWidth) {
            element.style.maxWidth = maxWidth;
        }
    }

    /* ------------------------- Toast notifications ------------------------- */

    var Toast = (function () {
        var containers = {};
        var iconClasses = {
            success: "fas fa-check-circle",
            error: "fas fa-times-circle",
            info: "fas fa-info-circle",
            warning: "fas fa-exclamation-triangle"
        };

        function mergeOptions(custom) {
            var options = {
                duration: 3500,
                closeButton: true,
                position: "top-right",
                onClick: null
            };
            var key;
            for (key in Toast.options) {
                if (Toast.options.hasOwnProperty(key)) {
                    options[key] = Toast.options[key];
                }
            }
            custom = custom || {};
            for (key in custom) {
                if (custom.hasOwnProperty(key)) {
                    options[key] = custom[key];
                }
            }
            return options;
        }

        function getContainer(position) {
            position = position || "top-right";
            if (containers[position] && containers[position].parentNode) {
                return containers[position];
            }
            var container = document.createElement("div");
            container.className = "tr-toast-container tr-toast-" + position;
            container.setAttribute("aria-live", "polite");
            container.setAttribute("aria-atomic", "false");
            document.body.appendChild(container);
            containers[position] = container;
            return container;
        }

        function show(type, message, title, customOptions) {
            type = iconClasses[type] ? type : "info";
            if (title && typeof title === "object") {
                customOptions = title;
                title = "";
            }
            var options = mergeOptions(customOptions);
            var container = getContainer(options.position);
            var toast = document.createElement("div");
            toast.className = "tr-toast tr-toast-" + type;
            toast.setAttribute("role", type === "error" ? "alert" : "status");

            var iconWrap = document.createElement("span");
            iconWrap.className = "tr-toast-icon";
            iconWrap.setAttribute("aria-hidden", "true");
            var icon = document.createElement("i");
            icon.className = iconClasses[type];
            iconWrap.appendChild(icon);
            toast.appendChild(iconWrap);

            var content = document.createElement("span");
            content.className = "tr-toast-content";
            if (title) {
                var titleElement = document.createElement("strong");
                titleElement.className = "tr-toast-title";
                titleElement.appendChild(document.createTextNode(String(title)));
                content.appendChild(titleElement);
            }
            var messageElement = document.createElement("span");
            messageElement.className = "tr-toast-message";
            messageElement.appendChild(
                document.createTextNode(
                    message === null || typeof message === "undefined"
                        ? ""
                        : String(message)
                )
            );
            content.appendChild(messageElement);
            toast.appendChild(content);

            var dismissed = false;
            function dismiss() {
                if (dismissed) {
                    return;
                }
                dismissed = true;
                toast.className += " tr-toast-hide";
                global.setTimeout(function () {
                    if (toast.parentNode) {
                        toast.parentNode.removeChild(toast);
                    }
                }, 200);
            }

            if (options.closeButton) {
                var closeButton = document.createElement("button");
                closeButton.type = "button";
                closeButton.className = "tr-toast-close";
                closeButton.title = "Close";
                closeButton.setAttribute("aria-label", "Close notification");
                var closeIcon = document.createElement("i");
                closeIcon.className = "fas fa-times";
                closeIcon.setAttribute("aria-hidden", "true");
                closeButton.appendChild(closeIcon);
                on(closeButton, "click", function (event) {
                    event.stopPropagation();
                    dismiss();
                });
                toast.appendChild(closeButton);
            }

            if (options.duration > 0) {
                var progress = document.createElement("span");
                progress.className = "tr-toast-progress";
                progress.style.animationDuration = options.duration + "ms";
                toast.appendChild(progress);
                global.setTimeout(dismiss, options.duration);
            }

            if (isFunction(options.onClick)) {
                on(toast, "click", function (event) {
                    options.onClick(toast, event);
                });
            }

            container.appendChild(toast);
            return toast;
        }

        return {
            options: {},
            show: show,
            success: function (message, title, options) {
                return show("success", message, title, options);
            },
            error: function (message, title, options) {
                return show("error", message, title, options);
            },
            info: function (message, title, options) {
                return show("info", message, title, options);
            },
            warning: function (message, title, options) {
                return show("warning", message, title, options);
            },
            clear: function () {
                var position;
                for (position in containers) {
                    if (containers.hasOwnProperty(position)) {
                        containers[position].innerHTML = "";
                    }
                }
            }
        };
    })();

    /* ------------------------- Constructor ------------------------- */

    function TableRenderer(options) {
        options = options || {};

        this.options = options;
        this.container = document.getElementById(options.containerId);
        if (!this.container) {
            throw new Error(
                "TableRenderer: container '" + options.containerId + "' not found."
            );
        }

        this.columns = options.columns || [];
        this.header = options.header || null;
        this.searchFields = options.searchFields || [];
        this.searchFunction = options.searchFunction;
        this.buttons = options.buttons || [];
        this.select2Options = options.select2Options || {};
        this.pageSizeSelect2Options = options.pageSizeSelect2Options || {};
        this.datepickerOptions = options.datepickerOptions || {};

        this.pageSizeOptions = options.pageSizeOptions || [10, 20, 50, 100];

        /* Callbacks */
        this.onRowClick = options.onRowClick;
        this.onDataLoaded = options.onDataLoaded;
        this.onSearchChanged = options.onSearchChanged;

        /* Internal state */
        this.state = {
            page: 1,
            pageSize: options.pageSize || this.pageSizeOptions[0] || 20,
            total: 0,
            sort: {
                field: options.sort && options.sort.field ? options.sort.field : null,
                type: options.sort && options.sort.type ? options.sort.type : null
            },
            filters: {}
        };

        this.currentData = [];
        this.loading = false;

        /* DOM references, filled in by _buildSkeleton. */
        this.dom = {};

        this._buildSkeleton();
        this.reload();
    }

    /* ------------------------- DOM skeleton ------------------------- */

    TableRenderer.prototype._buildSkeleton = function () {
        var self = this;

        this.container.className += (this.container.className ? " " : "") + "tr-root";
        this.container.innerHTML = "";
        this._renderComponentHeader();

        /* Search form */
        var searchForm = document.createElement("form");
        searchForm.className = "tr-search-form";
        on(searchForm, "submit", function (e) {
            if (e.preventDefault) {
                e.preventDefault();
            }
            self.state.page = 1;
            self.search();
            return false;
        });
        this._renderSearchFields(searchForm);
        this.container.appendChild(searchForm);
        this.dom.searchForm = searchForm;
        this._initSelect2();
        this._initDatepickers();

        /* Top toolbar: statistic on the left, action buttons on the right. */
        var toolbar = document.createElement("div");
        toolbar.className = "tr-toolbar";

        var statistic = document.createElement("div");
        statistic.className = "tr-statistic";
        toolbar.appendChild(statistic);
        this.dom.statistic = statistic;

        var toolbarActions = document.createElement("div");
        toolbarActions.className = "tr-toolbar-actions";
        this._renderToolbarButtons(toolbarActions);
        toolbar.appendChild(toolbarActions);
        this.dom.toolbarActions = toolbarActions;

        this.container.appendChild(toolbar);

        /* Table wrapper (for responsive horizontal scroll) + overlay */
        var tableWrap = document.createElement("div");
        tableWrap.className = "tr-table-wrap";

        var table = document.createElement("table");
        table.className = "tr-table";

        var thead = document.createElement("thead");
        var tbody = document.createElement("tbody");
        table.appendChild(thead);
        table.appendChild(tbody);
        tableWrap.appendChild(table);

        /* Loading overlay */
        var overlay = document.createElement("div");
        overlay.className = "tr-loading-overlay";
        overlay.style.display = "none";
        var spinner = document.createElement("div");
        spinner.className = "tr-spinner";
        var loadingText = document.createElement("div");
        loadingText.className = "tr-loading-text";
        loadingText.appendChild(document.createTextNode("Loading..."));
        overlay.appendChild(spinner);
        overlay.appendChild(loadingText);
        tableWrap.appendChild(overlay);

        this.container.appendChild(tableWrap);

        this.dom.thead = thead;
        this.dom.tbody = tbody;
        this.dom.overlay = overlay;

        /* Bottom footer: page size on the left, pagination on the right. */
        var footer = document.createElement("div");
        footer.className = "tr-footer";

        var pageSizeWrap = document.createElement("div");
        pageSizeWrap.className = "tr-pagesize";
        pageSizeWrap.appendChild(document.createTextNode("Show "));

        var pageSizeSelect = document.createElement("select");
        pageSizeSelect.className = "tr-pagesize-select tr-pagesize-select2";
        var i;
        for (i = 0; i < this.pageSizeOptions.length; i++) {
            var opt = document.createElement("option");
            opt.value = String(this.pageSizeOptions[i]);
            opt.appendChild(document.createTextNode(String(this.pageSizeOptions[i])));
            if (this.pageSizeOptions[i] === this.state.pageSize) {
                opt.selected = true;
            }
            pageSizeSelect.appendChild(opt);
        }
        /* Native change event fires when Select2 is NOT used (fallback).
           jQuery change is bound after Select2 init below to cover both paths. */
        pageSizeWrap.appendChild(pageSizeSelect);
        pageSizeWrap.appendChild(document.createTextNode(" entries"));
        footer.appendChild(pageSizeWrap);
        this.dom.pageSizeSelect = pageSizeSelect;

        var pagination = document.createElement("div");
        pagination.className = "tr-pagination";
        footer.appendChild(pagination);
        this.dom.pagination = pagination;

        this.container.appendChild(footer);

        /* Init Select2 for the page-size select, then bind change via jQuery so the
           handler fires whether the user interacts with native select or Select2. */
        this._initPageSizeSelect2();
        if (global.jQuery && isFunction(global.jQuery.fn.on)) {
            global.jQuery(pageSizeSelect).on("change", function () {
                self.setPageSize(parseInt(pageSizeSelect.value, 10));
            });
        } else {
            on(pageSizeSelect, "change", function () {
                self.setPageSize(parseInt(pageSizeSelect.value, 10));
            });
        }

        this._renderHeader();
    };

    TableRenderer.prototype._renderComponentHeader = function () {
        if (!this.header) {
            return;
        }

        var headerConfig = typeof this.header === "string"
            ? { title: this.header }
            : this.header;
        var header = document.createElement("div");
        header.className = "tr-component-header";

        if (headerConfig.title) {
            var title = document.createElement("h2");
            title.className = "tr-component-title";
            title.appendChild(document.createTextNode(headerConfig.title));
            header.appendChild(title);
        }
        if (headerConfig.description) {
            var description = document.createElement("p");
            description.className = "tr-component-description";
            description.appendChild(document.createTextNode(headerConfig.description));
            header.appendChild(description);
        }

        this.container.appendChild(header);
        this.dom.componentHeader = header;
    };

    TableRenderer.prototype._renderToolbarButtons = function (container) {
        var self = this;
        var i;

        for (i = 0; i < this.buttons.length; i++) {
            (function (buttonConfig) {
                if (buttonConfig.type === "dropdown") {
                    self._renderToolbarDropdown(container, buttonConfig);
                    return;
                }

                var button = document.createElement("button");
                button.type = "button";
                button.className = "tr-btn";
                if (buttonConfig.className) {
                    button.className += " " + buttonConfig.className;
                }
                if (buttonConfig.title) {
                    button.title = buttonConfig.title;
                }
                if (buttonConfig.iconClass) {
                    var icon = document.createElement("i");
                    icon.className = buttonConfig.iconClass + " tr-btn-icon";
                    icon.setAttribute("aria-hidden", "true");
                    button.appendChild(icon);
                }
                button.appendChild(
                    document.createTextNode(buttonConfig.text || buttonConfig.label || "Action")
                );
                if (isFunction(buttonConfig.onClick)) {
                    on(button, "click", function (event) {
                        buttonConfig.onClick(self, button, event || global.event);
                    });
                }
                container.appendChild(button);
            })(this.buttons[i]);
        }
    };

    TableRenderer.prototype._renderToolbarDropdown = function (container, config) {
        var self = this;
        var wrap = document.createElement("span");
        wrap.className = "tr-toolbar-dropdown";

        var trigger = document.createElement("button");
        trigger.type = "button";
        trigger.className = "tr-toolbar-menu-trigger";
        trigger.title = config.title || "Actions";
        trigger.setAttribute("aria-haspopup", "true");
        trigger.setAttribute("aria-expanded", "false");

        var triggerIcon = document.createElement(config.iconClass ? "i" : "span");
        triggerIcon.className = "tr-toolbar-menu-trigger-icon";
        if (config.iconClass) {
            triggerIcon.className += " " + config.iconClass;
        }
        triggerIcon.setAttribute("aria-hidden", "true");
        if (!config.iconClass) {
            triggerIcon.appendChild(document.createTextNode(config.icon || "\u22ef"));
        }
        trigger.appendChild(triggerIcon);

        var triggerLabel = document.createElement("span");
        triggerLabel.className = "tr-visually-hidden";
        triggerLabel.appendChild(document.createTextNode(config.title || "Actions"));
        trigger.appendChild(triggerLabel);

        var menu = document.createElement("div");
        menu.className = "tr-toolbar-menu";
        menu.setAttribute("role", "menu");

        function setOpen(open) {
            wrap.className = "tr-toolbar-dropdown" + (open ? " tr-toolbar-dropdown-open" : "");
            trigger.setAttribute("aria-expanded", open ? "true" : "false");
        }

        on(trigger, "click", function (event) {
            event = event || global.event;
            if (event.stopPropagation) {
                event.stopPropagation();
            } else {
                event.cancelBubble = true;
            }
            setOpen(wrap.className.indexOf("tr-toolbar-dropdown-open") === -1);
        });

        var actions = config.actions || [];
        var i;
        for (i = 0; i < actions.length; i++) {
            (function (actionConfig) {
                if (isFunction(actionConfig.visible) && !actionConfig.visible(self)) {
                    return;
                }

                var item = document.createElement("button");
                item.type = "button";
                item.className = "tr-toolbar-menu-item";
                item.setAttribute("role", "menuitem");
                if (actionConfig.className) {
                    item.className += " " + actionConfig.className;
                }
                if (actionConfig.disabled === true) {
                    item.disabled = true;
                }

                if (actionConfig.icon || actionConfig.iconClass) {
                    var icon = document.createElement(actionConfig.iconClass ? "i" : "span");
                    icon.className = "tr-toolbar-menu-item-icon";
                    if (actionConfig.iconClass) {
                        icon.className += " " + actionConfig.iconClass;
                    }
                    icon.setAttribute("aria-hidden", "true");
                    if (!actionConfig.iconClass) {
                        icon.appendChild(document.createTextNode(actionConfig.icon));
                    }
                    item.appendChild(icon);
                }

                var label = document.createElement("span");
                label.className = "tr-toolbar-menu-item-label";
                label.appendChild(
                    document.createTextNode(actionConfig.text || actionConfig.label || "Action")
                );
                item.appendChild(label);

                on(item, "click", function (event) {
                    event = event || global.event;
                    if (event.stopPropagation) {
                        event.stopPropagation();
                    } else {
                        event.cancelBubble = true;
                    }
                    setOpen(false);
                    if (isFunction(actionConfig.onClick)) {
                        actionConfig.onClick(self, item, event);
                    }
                });
                menu.appendChild(item);
            })(actions[i]);
        }

        on(wrap, "keydown", function (event) {
            event = event || global.event;
            if ((event.which || event.keyCode) === 27) {
                setOpen(false);
                trigger.focus();
            }
        });
        on(document, "click", function () {
            setOpen(false);
        });

        wrap.appendChild(trigger);
        wrap.appendChild(menu);
        container.appendChild(wrap);
    };

    /* ------------------------- Search fields ------------------------- */

    TableRenderer.prototype._renderSearchFields = function (form) {
        var self = this;
        var i;

        if (!this.searchFields.length) {
            form.style.display = "none";
            return;
        }

        for (i = 0; i < this.searchFields.length; i++) {
            this._renderSearchField(form, this.searchFields[i]);
        }

        var actions = document.createElement("div");
        actions.className = "tr-search-actions";

        var searchBtn = document.createElement("button");
        searchBtn.type = "submit";
        searchBtn.className = "tr-btn tr-btn-primary tr-btn-search";
        var searchIcon = document.createElement("i");
        searchIcon.className = "fas fa-search tr-btn-icon";
        searchIcon.setAttribute("aria-hidden", "true");
        searchBtn.appendChild(searchIcon);
        searchBtn.appendChild(document.createTextNode("Tìm kiếm"));
        actions.appendChild(searchBtn);

        var resetBtn = document.createElement("button");
        resetBtn.type = "button";
        resetBtn.className = "tr-btn tr-btn-reset";
        var resetIcon = document.createElement("i");
        resetIcon.className = "fas fa-sync-alt tr-btn-icon";
        resetIcon.setAttribute("aria-hidden", "true");
        resetBtn.appendChild(resetIcon);
        resetBtn.appendChild(document.createTextNode("Đặt lại"));
        on(resetBtn, "click", function () {
            self.resetFilter();
        });
        actions.appendChild(resetBtn);

        form.appendChild(actions);
    };

    TableRenderer.prototype._renderSearchField = function (form, field) {
        var wrap = document.createElement("div");
        wrap.className = "tr-field tr-field-" + (field.type || "text");
        if (field.width) {
            wrap.style.width = typeof field.width === "number"
                ? field.width + "px"
                : field.width;
        }

        var label = document.createElement("label");
        label.className = "tr-field-label";
        label.appendChild(document.createTextNode(field.label || field.name));
        wrap.appendChild(label);

        var type = field.type || "text";
        var input;

        if (type === "select") {
            input = document.createElement("select");
            input.className = "tr-input tr-select2";
            input.setAttribute("data-field", field.name);
            input.setAttribute("data-placeholder", field.placeholder || "Chọn...");
            input._trSelect2Options = field.select2Options || {};
            var isMultiple = field.multiple === true;
            input._trMultiple = isMultiple;
            if (isMultiple) {
                input.multiple = true;
                input.setAttribute("multiple", "multiple");
            }
            var options = field.options || [];
            /* A single-select needs an empty option so the placeholder shows;
               a multi-select must not have one. */
            if (!isMultiple) {
                var placeholder = document.createElement("option");
                placeholder.value = "";
                placeholder.appendChild(
                    document.createTextNode(field.placeholder || "Chọn...")
                );
                input.appendChild(placeholder);
            }
            var i;
            for (i = 0; i < options.length; i++) {
                var o = document.createElement("option");
                o.value = String(options[i].value);
                o.appendChild(document.createTextNode(options[i].label));
                input.appendChild(o);
            }
            wrap.appendChild(input);
        } else if (type === "daterange") {
            /* Two jQuery UI datepicker inputs: name_from and name_to. */
            var rangeWrap = document.createElement("div");
            rangeWrap.className = "tr-daterange";

            var from = document.createElement("input");
            from.type = "text";
            from.className = "tr-input tr-datepicker tr-datepicker-from";
            from.setAttribute("data-field", field.name + "_from");
            from.setAttribute("placeholder", field.fromPlaceholder || "From date");
            from._trDatepickerOptions = field.datepickerOptions || {};
            rangeWrap.appendChild(from);

            rangeWrap.appendChild(document.createTextNode(" - "));

            var to = document.createElement("input");
            to.type = "text";
            to.className = "tr-input tr-datepicker tr-datepicker-to";
            to.setAttribute("data-field", field.name + "_to");
            to.setAttribute("placeholder", field.toPlaceholder || "To date");
            to._trDatepickerOptions = field.datepickerOptions || {};
            rangeWrap.appendChild(to);

            wrap.appendChild(rangeWrap);
        } else {
            input = document.createElement("input");
            input.type = "text";
            input.className = type === "date"
                ? "tr-input tr-datepicker"
                : "tr-input";
            input.setAttribute("data-field", field.name);
            if (field.placeholder) {
                input.setAttribute("placeholder", field.placeholder);
            }
            if (type === "date") {
                input._trDatepickerOptions = field.datepickerOptions || {};
            }
            wrap.appendChild(input);
        }

        form.appendChild(wrap);
    };

    /* Enhance date and daterange fields with jQuery UI Datepicker. */
    TableRenderer.prototype._initDatepickers = function () {
        if (
            !global.jQuery ||
            !global.jQuery.fn ||
            !isFunction(global.jQuery.fn.datepicker) ||
            !this.dom.searchForm
        ) {
            return;
        }

        var self = this;
        var inputs = this.dom.searchForm.querySelectorAll("input.tr-datepicker[data-field]");
        var i;
        var key;

        for (i = 0; i < inputs.length; i++) {
            var options = cloneObject(this.datepickerOptions);
            var fieldOptions = inputs[i]._trDatepickerOptions || {};
            for (key in fieldOptions) {
                if (fieldOptions.hasOwnProperty(key)) {
                    options[key] = fieldOptions[key];
                }
            }
            if (!options.dateFormat) {
                options.dateFormat = "yy-mm-dd";
            }
            if (!options.searchDateFormat) {
                options.searchDateFormat = "yy-mm-dd";
            }
            inputs[i]._trDatepickerSearchFormat = options.searchDateFormat;
            delete options.searchDateFormat;
            if (typeof options.showButtonPanel === "undefined") {
                options.showButtonPanel = true;
            }
            inputs[i]._trDatepickerOnSelect = options.onSelect;

            /* Apply Select2 on month/year dropdowns each time the datepicker
               opens or navigates, so hover colour follows the theme. */
            var s2Opts = {
                minimumResultsForSearch: Infinity,
                width: "resolve",
                dropdownCssClass: "tr-datepicker-select2-dropdown"
            };
            options.beforeShow = function (input, inst) {
                global.setTimeout(function () {
                    inst.dpDiv.find("select.ui-datepicker-month, select.ui-datepicker-year")
                        .each(function () {
                            if (!global.jQuery(this).hasClass("select2-hidden-accessible")) {
                                global.jQuery(this).select2(s2Opts);
                            }
                        });
                }, 0);
            };
            options.onChangeMonthYear = function (year, month, inst) {
                global.setTimeout(function () {
                    inst.dpDiv.find("select.ui-datepicker-month, select.ui-datepicker-year")
                        .each(function () {
                            if (!global.jQuery(this).hasClass("select2-hidden-accessible")) {
                                global.jQuery(this).select2(s2Opts);
                            }
                        });
                }, 0);
            };

            global.jQuery(inputs[i]).datepicker(options);
        }

        var ranges = this.dom.searchForm.querySelectorAll(".tr-daterange");
        for (i = 0; i < ranges.length; i++) {
            (function (range) {
                var from = range.querySelector(".tr-datepicker-from");
                var to = range.querySelector(".tr-datepicker-to");
                if (!from || !to) {
                    return;
                }

                global.jQuery(from).datepicker("option", "onSelect", function (dateText, instance) {
                    self._refreshDatepickerRange(range);
                    if (isFunction(from._trDatepickerOnSelect)) {
                        from._trDatepickerOnSelect.call(from, dateText, instance);
                    }
                });
                global.jQuery(to).datepicker("option", "onSelect", function (dateText, instance) {
                    self._refreshDatepickerRange(range);
                    if (isFunction(to._trDatepickerOnSelect)) {
                        to._trDatepickerOnSelect.call(to, dateText, instance);
                    }
                });
                on(from, "change", function () {
                    self._refreshDatepickerRange(range);
                });
                on(to, "change", function () {
                    self._refreshDatepickerRange(range);
                });
                self._refreshDatepickerRange(range);
            })(ranges[i]);
        }
    };

    TableRenderer.prototype._refreshDatepickerRange = function (range) {
        if (!range || !global.jQuery || !isFunction(global.jQuery.fn.datepicker)) {
            return;
        }
        var from = range.querySelector(".tr-datepicker-from");
        var to = range.querySelector(".tr-datepicker-to");
        if (!from || !to) {
            return;
        }
        try {
            global.jQuery(to).datepicker("option", "minDate", from.value || null);
            global.jQuery(from).datepicker("option", "maxDate", to.value || null);
        } catch (ignore) {
            /* Keep typed values even when they do not match dateFormat yet. */
        }
    };

    TableRenderer.prototype._refreshAllDatepickerRanges = function () {
        if (!this.dom.searchForm) {
            return;
        }
        var ranges = this.dom.searchForm.querySelectorAll(".tr-daterange");
        var i;
        for (i = 0; i < ranges.length; i++) {
            this._refreshDatepickerRange(ranges[i]);
        }
    };

    TableRenderer.prototype._formatDatepickerForSearch = function (element) {
        if (
            !element ||
            !element.value ||
            !global.jQuery ||
            !global.jQuery.datepicker ||
            !isFunction(global.jQuery.datepicker.formatDate)
        ) {
            return element ? element.value : "";
        }

        try {
            var date = global.jQuery(element).datepicker("getDate");
            if (date) {
                return global.jQuery.datepicker.formatDate(
                    element._trDatepickerSearchFormat || "yy-mm-dd",
                    date
                );
            }
        } catch (ignore) {
            /* Return the typed value when it cannot be parsed by Datepicker. */
        }
        return element.value;
    };

    TableRenderer.prototype._syncDatepicker = function (element) {
        if (
            !element ||
            !global.jQuery ||
            !global.jQuery.fn ||
            !isFunction(global.jQuery.fn.datepicker)
        ) {
            return;
        }
        var datepicker = global.jQuery(element);
        if (datepicker.hasClass("hasDatepicker")) {
            if (!element.value) {
                datepicker.datepicker("setDate", null);
                return;
            }
            try {
                var date = global.jQuery.datepicker.parseDate(
                    element._trDatepickerSearchFormat || "yy-mm-dd",
                    element.value
                );
                datepicker.datepicker("setDate", date);
            } catch (requestFormatError) {
                try {
                    datepicker.datepicker("setDate", element.value);
                } catch (displayFormatError) {
                    /* Leave an invalid manually supplied value unchanged. */
                }
            }
        }
    };

    /* Enhance search selects when jQuery Select2 is available. */
    TableRenderer.prototype._initSelect2 = function () {
        if (
            !global.jQuery ||
            !global.jQuery.fn ||
            !isFunction(global.jQuery.fn.select2) ||
            !this.dom.searchForm
        ) {
            return;
        }

        var selects = this.dom.searchForm.querySelectorAll("select.tr-select2[data-field]");
        var i;
        var key;
        for (i = 0; i < selects.length; i++) {
            var options = cloneObject(this.select2Options);
            var fieldOptions = selects[i]._trSelect2Options || {};
            for (key in fieldOptions) {
                if (fieldOptions.hasOwnProperty(key)) {
                    options[key] = fieldOptions[key];
                }
            }
            if (typeof options.placeholder === "undefined") {
                options.placeholder = selects[i].getAttribute("data-placeholder") || "Chọn...";
            }
            /* allowClear is not supported together with multiple select. */
            if (selects[i]._trMultiple) {
                options.allowClear = false;
                options.multiple = true;
            } else if (typeof options.allowClear === "undefined") {
                options.allowClear = true;
            }
            if (typeof options.minimumResultsForSearch === "undefined") {
                options.minimumResultsForSearch = 6;
            }
            if (!options.width) {
                options.width = "resolve";
            }
            global.jQuery(selects[i]).select2(options);
        }
    };

    TableRenderer.prototype._initPageSizeSelect2 = function () {
        if (
            !this.dom.pageSizeSelect ||
            !global.jQuery ||
            !global.jQuery.fn ||
            !isFunction(global.jQuery.fn.select2)
        ) {
            return;
        }

        var options = cloneObject(this.pageSizeSelect2Options);
        if (typeof options.minimumResultsForSearch === "undefined") {
            options.minimumResultsForSearch =
                typeof this.select2Options.minimumResultsForSearch === "number"
                    ? this.select2Options.minimumResultsForSearch
                    : 6;
        }
        if (!options.width) {
            options.width = "72px";
        }
        global.jQuery(this.dom.pageSizeSelect).select2(options);
    };

    /* Set a form control's value, handling multiple select (array value). */
    TableRenderer.prototype._setFieldValue = function (element, value) {
        if (element._trMultiple) {
            var selectedValues = isArray(value)
                ? value
                : (value === null || value === undefined || value === "" ? [] : [value]);
            var map = {};
            var v;
            for (v = 0; v < selectedValues.length; v++) {
                map[String(selectedValues[v])] = true;
            }
            var opts = element.options;
            var o;
            for (o = 0; o < opts.length; o++) {
                opts[o].selected = !!map[opts[o].value];
            }
        } else {
            element.value = value === null || value === undefined ? "" : value;
        }
    };

    /* Keep the Select2 UI in sync after a programmatic value change. */
    TableRenderer.prototype._syncSelect2 = function (element) {
        if (
            element &&
            element.tagName &&
            element.tagName.toLowerCase() === "select" &&
            global.jQuery &&
            global.jQuery.fn &&
            isFunction(global.jQuery.fn.select2)
        ) {
            global.jQuery(element).trigger("change.select2");
        }
    };

    /* Collect all filter values from the search form. */
    TableRenderer.prototype._collectFilters = function () {
        var filters = {};
        if (!this.dom.searchForm) {
            return filters;
        }
        var inputs = this.dom.searchForm.querySelectorAll("[data-field]");
        var i;
        for (i = 0; i < inputs.length; i++) {
            var el = inputs[i];
            var name = el.getAttribute("data-field");

            /* Multiple select returns an array of selected values. */
            if (el._trMultiple) {
                var selected = [];
                var opts = el.options;
                var o;
                for (o = 0; o < opts.length; o++) {
                    if (opts[o].selected && opts[o].value !== "") {
                        selected.push(opts[o].value);
                    }
                }
                if (selected.length) {
                    filters[name] = selected;
                }
                continue;
            }

            var value = el.value;
            if ((" " + el.className + " ").indexOf(" tr-datepicker ") !== -1) {
                value = this._formatDatepickerForSearch(el);
            }
            if (value !== null && String(value) !== "") {
                filters[name] = value;
            }
        }
        return filters;
    };

    /* ------------------------- Header / sort ------------------------- */

    TableRenderer.prototype._renderHeader = function () {
        var self = this;
        var thead = this.dom.thead;
        thead.innerHTML = "";

        var tr = document.createElement("tr");
        var i;
        for (i = 0; i < this.columns.length; i++) {
            (function (col) {
                var th = document.createElement("th");
                th.className = "tr-th";
                if (col.type === "actions") {
                    th.className += " tr-th-actions";
                }
                applyColumnSize(th, col);

                var titleSpan = document.createElement("span");
                titleSpan.appendChild(document.createTextNode(col.title || col.field));
                th.appendChild(titleSpan);

                if (col.sortable) {
                    th.className += " tr-sortable";
                    var indicator = document.createElement("span");
                    indicator.className = "tr-sort-indicator";
                    if (self.state.sort.field === col.field) {
                        if (self.state.sort.type === "ASC") {
                            indicator.innerHTML = "&#9650;"; /* up */
                            th.className += " tr-sorted-asc";
                        } else if (self.state.sort.type === "DESC") {
                            indicator.innerHTML = "&#9660;"; /* down */
                            th.className += " tr-sorted-desc";
                        } else {
                            indicator.innerHTML = "&#8693;";
                        }
                    } else {
                        indicator.innerHTML = "&#8693;"; /* up/down */
                    }
                    th.appendChild(indicator);

                    on(th, "click", function () {
                        self._cycleSort(col.field);
                    });
                }

                tr.appendChild(th);
            })(this.columns[i]);
        }
        thead.appendChild(tr);
    };

    /* Cycle: current field ASC -> DESC -> NONE. */
    TableRenderer.prototype._cycleSort = function (field) {
        if (this.state.sort.field !== field) {
            this.state.sort.field = field;
            this.state.sort.type = "ASC";
        } else if (this.state.sort.type === "ASC") {
            this.state.sort.type = "DESC";
        } else if (this.state.sort.type === "DESC") {
            this.state.sort.field = null;
            this.state.sort.type = null;
        } else {
            this.state.sort.type = "ASC";
        }
        this.state.page = 1;
        this._renderHeader();
        this.reload();
    };

    /* ------------------------- Data loading ------------------------- */

    TableRenderer.prototype._buildRequest = function () {
        return {
            page: this.state.page,
            pageSize: this.state.pageSize,
            sort: cloneObject(this.state.sort),
            filters: cloneObject(this.state.filters)
        };
    };

    TableRenderer.prototype._load = function () {
        var self = this;

        if (!isFunction(this.searchFunction)) {
            throw new Error("TableRenderer: searchFunction is required.");
        }

        this._setLoading(true);
        var request = this._buildRequest();

        this.searchFunction(request, function (response) {
            self._setLoading(false);
            response = response || {};

            self.state.total = typeof response.total === "number" ? response.total : 0;
            if (typeof response.page === "number") {
                self.state.page = response.page;
            }
            /* Do NOT update pageSize from API response — only the user's explicit
               action (setPageSize / setSearchModel) should change the selected size. */
            self.currentData = isArray(response.data) ? response.data : [];

            self._renderBody();
            self._renderStatistic();
            self._renderPagination();

            if (isFunction(self.onDataLoaded)) {
                self.onDataLoaded(response);
            }
        });
    };

    /* _setLoading is intentionally a no-op: the table overlay is disabled to
       avoid screen flicker on fast responses. Use Loading.show() / Loading.hide()
       (or the global shorthand showLoading() / hideLoading()) from your own
       async handlers instead. */
    TableRenderer.prototype._setLoading = function (flag) {
        // Tạm đóng lại do loading hơi nhiều khi search, next trang
        /* if (flag) {
            Loading.show();
        } else {
            Loading.hide();
        } */
    };

    /* ------------------------- Body render ------------------------- */

    TableRenderer.prototype._renderBody = function () {
        var self = this;
        var tbody = this.dom.tbody;
        tbody.innerHTML = "";

        if (!this.currentData.length) {
            var emptyTr = document.createElement("tr");
            var emptyTd = document.createElement("td");
            emptyTd.className = "tr-empty";
            emptyTd.setAttribute("colspan", String(this.columns.length || 1));
            emptyTd.appendChild(document.createTextNode("No data found"));
            emptyTr.appendChild(emptyTd);
            tbody.appendChild(emptyTr);
            return;
        }

        var rowIndex;
        for (rowIndex = 0; rowIndex < this.currentData.length; rowIndex++) {
            (function (row, index) {
                var tr = document.createElement("tr");
                tr.className = "tr-row";

                var c;
                for (c = 0; c < self.columns.length; c++) {
                    var col = self.columns[c];
                    var td = document.createElement("td");
                    td.className = "tr-td";
                    applyColumnSize(td, col);

                    if (col.type === "actions") {
                        td.className += " tr-action-cell";
                        self._renderRowActions(td, col.actions || [], row, index);
                    } else {
                        var value = row[col.field];
                        if (isFunction(col.render)) {
                            /* Custom renderer returns an HTML string. */
                            td.innerHTML = col.render(value, row, index);
                        } else {
                            td.innerHTML = escapeHtml(value);
                        }
                    }
                    tr.appendChild(td);
                }

                on(tr, "click", function () {
                    if (isFunction(self.onRowClick)) {
                        self.onRowClick(row, index);
                    }
                });

                tbody.appendChild(tr);
            })(this.currentData[rowIndex], rowIndex);
        }
    };

    TableRenderer.prototype._renderRowActions = function (cell, actions, row, index) {
        var actionWrap = document.createElement("span");
        actionWrap.className = "tr-row-actions";
        var i;

        for (i = 0; i < actions.length; i++) {
            (function (actionConfig) {
                if (
                    isFunction(actionConfig.visible) &&
                    !actionConfig.visible(row, index)
                ) {
                    return;
                }

                var link = document.createElement("a");
                var href = isFunction(actionConfig.href)
                    ? actionConfig.href(row, index)
                    : actionConfig.href;
                href = href || "#";

                link.className = "tr-action-link";
                if (actionConfig.className) {
                    link.className += " " + actionConfig.className;
                }
                link.href = href;
                if (actionConfig.target) {
                    link.target = actionConfig.target;
                }
                if (actionConfig.title) {
                    link.title = actionConfig.title;
                }
                var actionText = isFunction(actionConfig.text)
                    ? actionConfig.text(row, index)
                    : actionConfig.textField
                        ? row[actionConfig.textField]
                        : actionConfig.text || actionConfig.label || "Action";
                link.appendChild(
                    document.createTextNode(
                        actionText === null || typeof actionText === "undefined"
                            ? ""
                            : String(actionText)
                    )
                );

                on(link, "click", function (event) {
                    event = event || global.event;
                    if (event.stopPropagation) {
                        event.stopPropagation();
                    } else {
                        event.cancelBubble = true;
                    }
                    if (href === "#") {
                        if (event.preventDefault) {
                            event.preventDefault();
                        } else {
                            event.returnValue = false;
                        }
                    }
                    if (isFunction(actionConfig.onClick)) {
                        actionConfig.onClick(row, index, event);
                    }
                });

                actionWrap.appendChild(link);
            })(actions[i]);
        }

        cell.appendChild(actionWrap);
    };

    /* ------------------------- Statistic ------------------------- */

    TableRenderer.prototype._renderStatistic = function () {
        var total = this.state.total;
        var el = this.dom.statistic;

        if (!total) {
            el.innerHTML = "Showing 0 to 0 of 0 entries";
            return;
        }

        var from = (this.state.page - 1) * this.state.pageSize + 1;
        var to = Math.min(this.state.page * this.state.pageSize, total);

        el.innerHTML =
            "Showing " + from + " to " + to + " of " + total + " entries";
    };

    /* ------------------------- Pagination ------------------------- */

    TableRenderer.prototype._totalPages = function () {
        if (!this.state.total || !this.state.pageSize) {
            return 1;
        }
        return Math.max(1, Math.ceil(this.state.total / this.state.pageSize));
    };

    TableRenderer.prototype._renderPagination = function () {
        var self = this;
        var pagination = this.dom.pagination;
        pagination.innerHTML = "";

        var totalPages = this._totalPages();
        var current = this.state.page;

        function makeButton(label, targetPage, disabled, active) {
            var btn = document.createElement("button");
            btn.type = "button";
            btn.className = "tr-page-btn";
            if (active) {
                btn.className += " tr-page-active";
            }
            if (disabled) {
                btn.className += " tr-page-disabled";
                btn.disabled = true;
            }
            btn.innerHTML = label;
            if (!disabled && !active) {
                on(btn, "click", function () {
                    self.gotoPage(targetPage);
                });
            }
            return btn;
        }

        pagination.appendChild(makeButton("&#171; First", 1, current <= 1, false));
        pagination.appendChild(
            makeButton("&#8249; Prev", current - 1, current <= 1, false)
        );

        /* Window of page numbers around the current page. */
        var windowSize = 5;
        var start = Math.max(1, current - Math.floor(windowSize / 2));
        var end = Math.min(totalPages, start + windowSize - 1);
        start = Math.max(1, Math.min(start, end - windowSize + 1));

        var p;
        for (p = start; p <= end; p++) {
            pagination.appendChild(
                makeButton(String(p), p, false, p === current)
            );
        }

        pagination.appendChild(
            makeButton("Next &#8250;", current + 1, current >= totalPages, false)
        );
        pagination.appendChild(
            makeButton("Last &#187;", totalPages, current >= totalPages, false)
        );

        /* Jump to page */
        var jumpWrap = document.createElement("span");
        jumpWrap.className = "tr-page-jump";
        jumpWrap.appendChild(document.createTextNode("Go to "));

        var jumpInput = document.createElement("input");
        jumpInput.type = "number";
        jumpInput.className = "tr-page-jump-input";
        jumpInput.min = "1";
        jumpInput.max = String(totalPages);
        jumpInput.value = String(current);
        on(jumpInput, "keydown", function (e) {
            var key = e.which || e.keyCode;
            if (key === 13) {
                if (e.preventDefault) {
                    e.preventDefault();
                }
                self.gotoPage(parseInt(jumpInput.value, 10));
            }
        });
        jumpWrap.appendChild(jumpInput);

        var jumpBtn = document.createElement("button");
        jumpBtn.type = "button";
        jumpBtn.className = "tr-page-btn";
        jumpBtn.appendChild(document.createTextNode("Go"));
        on(jumpBtn, "click", function () {
            self.gotoPage(parseInt(jumpInput.value, 10));
        });
        jumpWrap.appendChild(jumpBtn);

        var pageTotal = document.createElement("span");
        pageTotal.className = "tr-page-total";
        pageTotal.appendChild(document.createTextNode("of " + totalPages));
        jumpWrap.appendChild(pageTotal);

        pagination.appendChild(jumpWrap);
    };

    /* ------------------------- Public API ------------------------- */

    /* Reload using the current state (does not re-collect the form). */
    TableRenderer.prototype.reload = function () {
        this._load();
        return this;
    };

    /* Collect the search form, reset to page 1 and reload. */
    TableRenderer.prototype.search = function () {
        this.state.filters = this._collectFilters();
        this.state.page = 1;
        if (isFunction(this.onSearchChanged)) {
            this.onSearchChanged(cloneObject(this.state.filters));
        }
        this._load();
        return this;
    };

    /* Clear the form inputs and reload. */
    TableRenderer.prototype.resetFilter = function () {
        if (this.dom.searchForm) {
            var inputs = this.dom.searchForm.querySelectorAll("[data-field]");
            var i;
            for (i = 0; i < inputs.length; i++) {
                this._setFieldValue(inputs[i], "");
                this._syncDatepicker(inputs[i]);
                this._syncSelect2(inputs[i]);
            }
            this._refreshAllDatepickerRanges();
        }
        this.state.filters = {};
        this.state.page = 1;
        if (isFunction(this.onSearchChanged)) {
            this.onSearchChanged({});
        }
        this._load();
        return this;
    };

    TableRenderer.prototype.gotoPage = function (page) {
        var totalPages = this._totalPages();
        page = parseInt(page, 10);
        if (isNaN(page)) {
            return this;
        }
        if (page < 1) {
            page = 1;
        }
        if (page > totalPages) {
            page = totalPages;
        }
        if (page === this.state.page) {
            return this;
        }
        this.state.page = page;
        this._load();
        return this;
    };

    TableRenderer.prototype.setPageSize = function (size) {
        size = parseInt(size, 10);
        if (isNaN(size) || size < 1) {
            return this;
        }
        this.state.pageSize = size;
        this.state.page = 1; /* Changing page size must reset to page 1. */
        if (this.dom.pageSizeSelect) {
            this.dom.pageSizeSelect.value = String(size);
            this._syncSelect2(this.dom.pageSizeSelect);
        }
        this._load();
        return this;
    };

    TableRenderer.prototype.setSort = function (sort) {
        sort = sort || {};
        this.state.sort = {
            field: sort.field || null,
            type: sort.type || null
        };
        this.state.page = 1;
        this._renderHeader();
        this._load();
        return this;
    };

    TableRenderer.prototype.getSearchModel = function () {
        return this._buildRequest();
    };

    /* Load every row using the current filters and sort without changing table state. */
    TableRenderer.prototype.getAllData = function (callback) {
        var self = this;
        var request = this._buildRequest();

        if (!isFunction(this.searchFunction)) {
            throw new Error("TableRenderer: searchFunction is required.");
        }

        request.page = 1;
        request.pageSize = this.state.total || this.state.pageSize;
        this._setLoading(true);

        this.searchFunction(request, function (response) {
            response = response || {};
            self._setLoading(false);
            if (isFunction(callback)) {
                callback(isArray(response.data) ? response.data : [], response);
            }
        });
        return this;
    };

    TableRenderer.prototype.setSearchModel = function (model) {
        model = model || {};
        if (typeof model.page === "number") {
            this.state.page = model.page;
        }
        if (typeof model.pageSize === "number") {
            this.state.pageSize = model.pageSize;
            if (this.dom.pageSizeSelect) {
                this.dom.pageSizeSelect.value = String(model.pageSize);
                this._syncSelect2(this.dom.pageSizeSelect);
            }
        }
        if (model.sort) {
            this.state.sort = {
                field: model.sort.field || null,
                type: model.sort.type || null
            };
        }
        if (model.filters) {
            this.state.filters = cloneObject(model.filters);
            /* Reflect filters into native controls and their Select2 UI. */
            if (this.dom.searchForm) {
                var inputs = this.dom.searchForm.querySelectorAll("[data-field]");
                var i;
                for (i = 0; i < inputs.length; i++) {
                    var fieldName = inputs[i].getAttribute("data-field");
                    this._setFieldValue(
                        inputs[i],
                        this.state.filters.hasOwnProperty(fieldName)
                            ? this.state.filters[fieldName]
                            : ""
                    );
                    this._syncDatepicker(inputs[i]);
                    this._syncSelect2(inputs[i]);
                }
                this._refreshAllDatepickerRanges();
            }
        }
        this._renderHeader();
        this._load();
        return this;
    };

    function resolveRegisteredFunction(registry, name, type) {
        if (isFunction(name)) {
            return name;
        }
        if (!name) {
            return null;
        }
        if (!registry || !isFunction(registry[name])) {
            throw new Error(
                "TableRenderer: " + type + " '" + name + "' is not registered."
            );
        }
        return registry[name];
    }

    function hydrateActions(actions, handlers) {
        var hydrated = [];
        var i;
        actions = actions || [];
        for (i = 0; i < actions.length; i++) {
            var action = cloneObject(actions[i]);
            if (action.handler) {
                action.onClick = resolveRegisteredFunction(
                    handlers,
                    action.handler,
                    "handler"
                );
            }
            if (action.visibleHandler) {
                action.visible = resolveRegisteredFunction(
                    handlers,
                    action.visibleHandler,
                    "visible handler"
                );
            }
            if (action.hrefHandler) {
                action.href = resolveRegisteredFunction(
                    handlers,
                    action.hrefHandler,
                    "href handler"
                );
            }
            hydrated.push(action);
        }
        return hydrated;
    }

    function hydrateTableConfig(config, runtime) {
        if (!config || typeof config !== "object") {
            throw new Error("TableRenderer: a table config object is required.");
        }
        runtime = runtime || {};
        var handlers = runtime.handlers || {};
        var renderers = runtime.renderers || {};
        var callbacks = runtime.callbacks || {};
        var options = cloneObject(config);
        var i;

        options.containerId = runtime.containerId || config.containerId;
        options.searchFunction = runtime.searchFunction;
        if (!isFunction(options.searchFunction)) {
            throw new Error(
                "TableRenderer: runtime.searchFunction is required when loading DB config."
            );
        }

        options.columns = [];
        var columns = config.columns || [];
        for (i = 0; i < columns.length; i++) {
            var column = cloneObject(columns[i]);
            if (column.renderer) {
                column.render = resolveRegisteredFunction(
                    renderers,
                    column.renderer,
                    "renderer"
                );
            }
            if (column.actions) {
                column.actions = hydrateActions(column.actions, handlers);
            }
            options.columns.push(column);
        }

        options.searchFields = [];
        var searchFields = config.searchFields || [];
        for (i = 0; i < searchFields.length; i++) {
            var searchField = cloneObject(searchFields[i]);
            if (searchField.options) {
                searchField.options = searchField.options.slice(0);
            }
            options.searchFields.push(searchField);
        }

        options.buttons = [];
        var buttons = config.buttons || [];
        for (i = 0; i < buttons.length; i++) {
            var button = cloneObject(buttons[i]);
            if (button.handler) {
                button.onClick = resolveRegisteredFunction(
                    handlers,
                    button.handler,
                    "handler"
                );
            }
            if (button.actions) {
                button.actions = hydrateActions(button.actions, handlers);
            }
            options.buttons.push(button);
        }

        var eventNames = ["onRowClick", "onDataLoaded", "onSearchChanged"];
        var events = config.events || {};
        for (i = 0; i < eventNames.length; i++) {
            var eventName = eventNames[i];
            if (isFunction(callbacks[eventName])) {
                options[eventName] = callbacks[eventName];
            } else if (events[eventName]) {
                options[eventName] = resolveRegisteredFunction(
                    handlers,
                    events[eventName],
                    "event handler"
                );
            }
        }

        return options;
    }

    /* Export */
    TableRenderer.fromConfig = function (config, runtime) {
        return new TableRenderer(hydrateTableConfig(config, runtime));
    };

    /* ----------------------------------------------------------------
     * Loading — standalone singleton, same pattern as Toast.
     * Safe to call before any TableRenderer instance exists.
     *
     * Usage:
     *   Loading.show();
     *   doSomethingAsync(function () { Loading.hide(); });
     * ---------------------------------------------------------------- */
    var Loading = (function () {
        var overlay = null;

        function getOverlay() {
            if (overlay && overlay.parentNode) {
                return overlay;
            }

            overlay = document.createElement("div");
            overlay.id = "tr-global-loading";
            overlay.style.cssText = [
                "position:fixed",
                "top:0", "left:0", "right:0", "bottom:0",
                "background:rgba(255,255,255,0.72)",
                "z-index:19999",
                "display:none",
                "align-items:center",
                "justify-content:center",
                "flex-direction:column"
            ].join(";");

            var spinner = document.createElement("div");
            spinner.className = "tr-spinner";

            var text = document.createElement("div");
            text.className = "tr-loading-text";
            text.appendChild(document.createTextNode("Loading..."));

            overlay.appendChild(spinner);
            overlay.appendChild(text);
            document.body.appendChild(overlay);
            return overlay;
        }

        return {
            show: function () {
                getOverlay().style.display = "flex";
                return Loading;
            },
            hide: function () {
                if (overlay) {
                    overlay.style.display = "none";
                }
                return Loading;
            }
        };
    })();

    global.TableRenderer = TableRenderer;
    global.Toast = Toast;
    global.Loading = Loading;

    /* Shorthand globals — same pattern as Toast convenience calls. */
    global.showLoading = function () { Loading.show(); };
    global.hideLoading = function () { Loading.hide(); };
})(this);
