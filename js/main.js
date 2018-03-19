'use strict';

// Что еще можно и нужно было сделать:
// 1. При выкидывании невалидного поля, надо сказать пользователю, что с его данными не так (я намеренно не стал использовать HTML5 валидацию, а сделал свою)
// 2. При поиске желательно было бы еще добавить сколько вообще было результатов найдено и если нет реальтатов уведомить (по принципу с отсутствием книг)
// 3. Ограничение на размер имени автора и названия книги в блоке карточки книги
// 4. Проверка браузера на версию, чтобы сказать, что что-то может не работать
// 5. При сортировке можно, например, не делать сброс поиска
// 6. В сортировке нужно обозначить в какую сторону поиск (по возр., по убыв.)

(function() {
    const APPLICATION_PREFIX = 'ukit_test';

    // Некоторые вспомогательные функции
    const helpers = {
        hash: {
            guid: function() {
                function s4() {
                    return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
                }
                return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
            }
        },
        text: {
            toLower: function(str) {
                return (str).toString().toLowerCase();
            },
            truncate: function(str, max) {
                const t = (str).toString();
                return (t.length > max) ? t.substring(0, max) + '...' : t;
            }
        },
        time: {
            getTimestamp: function() {
                return (new Date()).getTime();
            }
        },
        validation: {
            isLikeInteger: function(str) {
                return /^\d+$/.test(str);
            }
        },
        escape: {
            getText: function(str) {
                const map = {
                    '&': '&amp;',
                    '<': '&lt;',
                    '>': '&gt;',
                    '"': '&quot;',
                    "'": '&#39;',
                    '/': '&#x2F;',
                    '`': '&#x60;',
                    '=': '&#x3D;'
                };

                return String(str).replace(/[&<>"'`=\/]/g, function(v) {
                    return map[v];
                });
            }
        }
    };

    // Упрощенная версия шаблонизатора
    const View = function() {
        const _this = this;
        const _templates = {
            modal: `
                <div class="overlay">
                    <div class="modal">
                        <div class="modal-header">{title}</div>
                            <div class="modal-content">
                                <p>{text}</p>
                            </div>
                            <div class="modal-bottom">
                                {buttons}
                            </div>
                    </div>
                </div>
            `,
            modal_button: `
                <button id="{id}" class="modal-button {color} {type}">{text}</button>
            `,
            book: `
                <div class="book">
                    <div class="book-author">{author}</div>
                    <div class="book-name">{name}</div>
                    <div class="book-controls">
                        <button class="book-button-edit button icon icon-edit"></button>
                        <button class="book-button-remove button icon icon-remove"></button>
                    </div>
                </div>
            `
        };

        _this.set = function(name, template) {
            _templates[name] = template;
        };

        _this.get = function(name) {
            return _templates.hasOwnProperty(name) ? _templates[name] : '';
        };

        _this.fill = function(name, data) {
            let output = '';

            if (_templates.hasOwnProperty(name)) {
                output = _templates[name];

                for (let i in data) {
                    if (data.hasOwnProperty(i)) {
                        output = output.replace(new RegExp('{' + i + '}', 'g'), data[i]);
                    }
                }
            }

            return output;
        };
    };

    // Локальное хранилище данных в localStorage, фолбэк на переменную
    const Storage = function() {
        const _this = this;
        let _data = {};
        let _isLocalStorage = false;
        let _storageKey = APPLICATION_PREFIX + '_storage';

        _this.isLocalStorageAvailable = function() {
            try {
                window.localStorage.setItem(_storageKey + '_test', 'test');
                window.localStorage.removeItem(_storageKey + '_test');
                return true;
            } catch(e) {
                return false;
            }
        };

        _this.init = function() {
            _isLocalStorage = _this.isLocalStorageAvailable();
            return _this;
        };

        _this.set = function(key, value) {
            _data[key] = value;

            if (_isLocalStorage) {
                window.localStorage.setItem(_storageKey, JSON.stringify(_data));
            }
        };

        _this.get = function(key) {
            if (_isLocalStorage) {
                let local = window.localStorage.getItem(_storageKey);

                try {
                    local = JSON.parse(local);

                    if (local.hasOwnProperty(key)) {
                        return local[key];
                    }
                } catch(err) {}

                return null;
            } else {
                return (_data.hasOwnProperty(key)) ? _data[key] : null;
            }
        };

        _this.all = function() {
            if (_isLocalStorage) {
                let local = window.localStorage.getItem(_storageKey);

                try {
                    local = JSON.parse(local);
                    return local;
                } catch(err) {}

                return {};
            } else {
                return _data;
            }
        };

        _this.remove = function(key) {
            if (_data.hasOwnProperty(key)) {
                delete _data[key];
            }

            if (_isLocalStorage) {
                window.localStorage.setItem(_storageKey, JSON.stringify(_data));
            }
        };

        _this.flush = function() {
            _data = {};

            if (_isLocalStorage) {
                window.localStorage.removeItem(_storageKey);
            }
        };
    };

    // Работа с ивентами, для более простой реактивности можно было сделать ивент эмиттер
    const Events = function() {
        const _this = this;

        _this.sendCustomEvent = function(name, data, element) {
            const event = new CustomEvent(name, {
                detail: (data) ? data : null,
                bubbles: true,
                cancelable: true
            });

            if (element) {
                element.dispatchEvent(event);
            } else {
                document.dispatchEvent(event);
            }
        }
    };

    // Основные методы для работы с элементами настраницы, просто удобная обертка
    const DOM = function() {
        const _this = this;

        _this.createElement = function(html) {
            const element = document.createElement('div');
            element.innerHTML = html.trim();
            return element.firstChild;
        };

        _this.find = function(query, element) {
            const elements = (element) ? element.querySelectorAll(query) : document.querySelectorAll(query);
            return (elements && elements.length) ? elements : [];
        };

        _this.attr = function(element, attrName, attrValue) {
            if (element) {
                return (attrValue) ? element.setAttribute(attrName, attrValue) : element.getAttribute(attrName);
            } else {
                return false;
            }
        };

        _this.addClass = function(element, className) {
            return (element && element.classList && element.classList.add(className));
        };

        _this.removeClass = function(element, className) {
            return (element && element.classList && element.classList.remove(className));
        };

        _this.hasClass = function(element, className) {
            return (element && element.classList && element.classList.contains(className));
        };

        _this.show = function(element) {
            return (element) ? _this.attr(element, 'style', 'display: block;') : false;
        };

        _this.hide = function(element) {
            return (element) ? _this.attr(element, 'style', 'display: none;') : false;
        };

        _this.removeWithAnimation = function(element, className, callback) {
            if (element) {
                _this.addClass(element, className);
                setTimeout(function() {
                    element.remove();
                    if (callback) callback();
                }, 400);
            }
        };
    };

    // Проверка на корректность, пока возможность проверять числа и строки, проверяемый элемент должен иметь атрибуты
    const Validation = function() {
        const _this = this;

        _this.isIntValid = function(value, min, max) {
            if (helpers.validation.isLikeInteger(value)) {
                const int = parseInt(value);
                const _min = (min && parseInt(min)) ? parseInt(min) : null;
                const _max = (max && parseInt(max)) ? parseInt(max) : null;

                if (int) {
                    if (_min) {
                        if (_min > value) return false;
                    }
                    if (_max) {
                        if (value > _max) return false;
                    }
                } else {
                    return false;
                }
            } else {
                return false;
            }

            return true;
        };

        _this.isStringValid = function(value, min, max) {
            if (value) {
                const str = value.trim();
                const _min = (min && parseInt(min)) ? parseInt(min) : null;
                const _max = (max && parseInt(max)) ? parseInt(max) : null;

                if (_min) {
                    if (_min > str.length) return false;
                }
                if (_max) {
                    if (str.length > _max) return false;
                }
            } else {
                return false;
            }

            return true;
        };

        _this.isValid = function(element, options) {
            if (element && options) {
                if (options.type === 'string') {
                    return _this.isStringValid(element.value, options.min, options.max);
                } else if (options.type === 'int') {
                    return _this.isIntValid(element.value, options.min, options.max);
                }

                return false;
            }
        }
    };

    const Application = function() {
        const _this = this;
        const _cache = {
            elements: {},
            books: {},
            modal: null,
            editable: null
        };
        const _view = new View();
        const _storage = (new Storage()).init();
        const _events = new Events();
        const _dom = new DOM();
        const _validation = new Validation();

        // Устанавливаем проверку на все вводимые поля в сайдбаре, если поле с ошибкой, то устанавливаем на него класс
        function inputValidationHandler(e) {
            const element = e.target;
            const type = _dom.attr(element, 'data-v-type');
            const min = _dom.attr(element, 'data-v-min');
            const max = _dom.attr(element, 'data-v-max');

            const result = _validation.isValid(element, {
                type: type,
                min: min,
                max: max
            });

            if (result) {
                _dom.removeClass(element, 'sidebar-input-error');
            } else {
                _dom.addClass(element, 'sidebar-input-error');
            }

            return result;
        }

        // Основной хандлер кликов по всей области
        function onDocumentClickHandler(e) {
            if (_dom.hasClass(e.target, 'book-button-edit')) {
                _events.sendCustomEvent('EVENT_BOOK_EDIT', { from: 'handler' }, e.target);
            }

            if (_dom.hasClass(e.target, 'book-button-remove')) {
                _events.sendCustomEvent('EVENT_BOOK_REMOVE', { from: 'handler' }, e.target);
            }

            if (_dom.attr(e.target, 'id') === 'sidebar-count-inc') {
                _this.methods.countValueIncrease(1);
                inputValidationHandler({ target: _cache.elements.input_count });
            }

            if (_dom.attr(e.target, 'id') === 'sidebar-count-dec') {
                _this.methods.countValueIncrease(-1);
                inputValidationHandler({ target: _cache.elements.input_count });
            }

            if (_dom.attr(e.target, 'id') === 'sidebar-button-revert') {
                _this.methods.setDefaultSidebar();
            }

            if (_dom.attr(e.target, 'id') === 'sidebar-button-save') {
                const cacheID = _cache.editable;

                _this.methods.saveBook({
                    parent: _cache.books[cacheID].parent,
                    name: _cache.elements.input_name.value,
                    author: _cache.elements.input_author.value,
                    date: _cache.elements.input_date.value,
                    count: _cache.elements.input_count.value
                }, _cache.editable, true);
            }

            if (_dom.attr(e.target, 'id') === 'sidebar-button-create') {
                _this.methods.createBook({
                    name: _cache.elements.input_name.value,
                    author: _cache.elements.input_author.value,
                    date: _cache.elements.input_date.value,
                    count: _cache.elements.input_count.value
                }, true);
            }

            if (_dom.attr(e.target, 'id') === 'content-top-sort-name') {
                e.preventDefault();

                if (Object.keys(_cache.books).length) {
                    const type = _dom.attr(e.target, 'data-s-type') || '0';
                    const books = Object.keys(_cache.books).map(function(v) {
                        return _cache.books[v];
                    });
                    let direction = -1;

                    // При работе с сортировкой сбрасываем поиск, его, по идее, можно и оставить
                    clearBookSearch(true);

                    // Сортировка 3-х типов: нет сортировки, по возр., по убыв. Переключаются последовательно
                    if (type === '0') {
                        _dom.attr(e.target, 'data-s-type', '1');
                        direction = -1;
                    } else if (type === '1') {
                        _dom.attr(e.target, 'data-s-type', '2');
                        direction = 1;
                    } else if (type === '2') {
                        _dom.attr(e.target, 'data-s-type', '0');
                        direction = 0;
                    }

                    if (direction) {
                        books.sort(function(a, b) {
                            return a.name === b.name ? 0 : a.name < b.name ? direction : (-1) * direction;
                        }).forEach(function(v) {
                            _cache.elements.books.appendChild(v.parent);
                        });
                    } else {
                        books.forEach(function(v) {
                            _cache.elements.books.appendChild(v.parent);
                        });
                    }
                }
            }

            if (_dom.attr(e.target, 'id') === 'sidebar-date-select') {
                _this.methods.showModal({
                    title: 'Что случилось?',
                    text: `В данной версии этот функционал недоступен.<br> Для его разблокировки пригласите на собеседование: <b>me@andrey-volkov.ru</b>`,
                    buttons: [
                        {
                            type: 'modal-button-1',
                            text: 'Пригласить',
                            onClick: function(e) {
                                location.href = 'mailto:me@andrey-volkov.ru&subject=' + encodeURIComponent('Мы приглашаем вас на собеседование');
                                e.modal.close();
                            }
                        }
                    ]
                });
            }
        }

        // Сброс результатов поиска и поисковой строки
        function clearBookSearch(resetInput) {
            const hidden = _dom.find('.book-search-hidden');
            for (let j in hidden) {
                if (hidden.hasOwnProperty(j)) {
                    _dom.removeClass(hidden[j], 'book-search-hidden');
                }
            }
            if (resetInput) {
                _cache.elements.content_search_input.value = '';
            }
        }

        // Основной хандлер поиска
        function booksSearch(value, e) {
            if (!!value) {
                for (let i in _cache.books) {
                    if (_cache.books.hasOwnProperty(i)) {
                        const b = helpers.text.toLower(_cache.books[i].name);
                        const f = helpers.text.toLower(value);

                        if (b.indexOf(f) >= 0) {
                            _dom.removeClass(_cache.books[i].parent, 'book-search-hidden');
                        } else {
                            _dom.addClass(_cache.books[i].parent, 'book-search-hidden');
                        }
                    }
                }
            } else {
                clearBookSearch();
            }
        }

        // При первой инициализации мы создаем кеш элементов на странице, чтобы постоянно их не искать,
        // понятное дело, что пока элементов мало, это имеет малую эффективность, но в целом небольшой прирост производительности
        // Также устанавливаем основные хандлеры на элементы
        _this.init = function() {
            _this.methods.initElementsCache();

            const stored = _storage.all();
            if (stored) {
                for (let i in stored) {
                    if (stored.hasOwnProperty(i)) {
                        _this.methods.createBook(stored[i], false);
                    }
                }
            }

            document.addEventListener('click', onDocumentClickHandler);
            _cache.elements.input_name.addEventListener('keyup', inputValidationHandler);
            _cache.elements.input_author.addEventListener('keyup', inputValidationHandler);
            _cache.elements.input_date.addEventListener('keyup', inputValidationHandler);
            _cache.elements.input_count.addEventListener('keyup', inputValidationHandler);

            if (_cache.elements.content_search_input) {
                _cache.elements.content_search_input.addEventListener('keyup', function(e) {
                    booksSearch(this.value, e)
                });
            }

            return _this;
        };

        // Некоторые методы для работы
        _this.methods = {
            // Создание локального кеша элементов
            initElementsCache: function() {
                _cache.elements = {
                    sidebar: _dom.find('#sidebar')[0],
                    sidebar_revert: _dom.find('#sidebar-button-revert')[0],
                    sidebar_save: _dom.find('#sidebar-button-save')[0],
                    sidebar_create: _dom.find('#sidebar-button-create')[0],
                    input_name: _dom.find('#input-name')[0],
                    input_author: _dom.find('#input-author')[0],
                    input_date: _dom.find('#input-date')[0],
                    input_count: _dom.find('#input-count')[0],
                    content: _dom.find('#content')[0],
                    books: _dom.find('#books')[0],
                    content_search_input: _dom.find('#content-top-search-input')[0],
                    content_sort_name: _dom.find('#content-top-sort-name')[0],
                    content_empty: _dom.find('#content-empty')[0],
                    count_inc: _dom.find('#sidebar-count-inc')[0],
                    count_dec: _dom.find('#sidebar-count-dec')[0],
                    date_select: _dom.find('sidebar-date-select')[0]
                };
            },

            // Хандлер для увеличения\уменьшения количества страниц
            countValueIncrease: function(value) {
                const v = _cache.elements.input_count.value;
                const int = parseInt(v);

                if (helpers.validation.isLikeInteger(v)) {
                    if (int + value >= 0) {
                        _cache.elements.input_count.value = int + value;
                    }
                } else {
                    _cache.elements.input_count.value = (int ? int : 0) + value;
                }
            },

            // Общая проверка на валидность, это лишь примерный вариант как можно сделать.
            // На самом деле нужно 100% делать информацию об ошибке, сейчас это неочевидно
            checkInputValidation: function() {
                const isNameValid = inputValidationHandler({ target: _cache.elements.input_name });
                const isAuthorValid = inputValidationHandler({ target: _cache.elements.input_author });
                const isDateValid = inputValidationHandler({ target: _cache.elements.input_date });
                const isCountValid = inputValidationHandler({ target: _cache.elements.input_count });

                if (!isNameValid || !isAuthorValid || !isDateValid || !isCountValid) {
                    _this.methods.showModal({
                        title: 'Проверьте',
                        text: `Проверьте, пожалуйста, форму на корректность заполненных данных и исправьте невалидные поля (обозначены красным цветом).`,
                        buttons: [
                            {
                                type: 'modal-button-1',
                                text: 'Хорошо',
                                onClick: function(e) {
                                    e.modal.close();
                                }
                            }
                        ]
                    });

                    return false;
                }

                return true;
            },

            // Создание модального окна
            showModal: function(options) {
                if (!options) {
                    return false;
                }
                if (_cache.modal) {
                    _cache.modal.close();
                }

                let overlay = null;
                let buttons = '';

                for (let i in options.buttons) {
                    if (options.buttons.hasOwnProperty(i)) {
                        buttons += _view.fill('modal_button', {
                            id: 'modal-button-' + i,
                            color: options.buttons[i].color,
                            type: options.buttons[i].type,
                            text: options.buttons[i].text
                        });
                    }
                }

                const template = _view.fill('modal', {
                    title: options.title,
                    text: options.text,
                    buttons: buttons
                });
                const body = _dom.find('body')[0];

                function closeModal() {
                    if (overlay) {
                        overlay.remove();
                        _cache.modal = null;
                    }
                }

                if (body) {
                    overlay = _dom.createElement(template);
                    overlay.className = 'overlay';
                    body.appendChild(overlay);

                    const output = {
                        element: overlay,
                        close: function() {
                            closeModal();
                        }
                    };

                    overlay.addEventListener('click', function(e) {
                        if (this === e.target) {
                            closeModal();
                        }

                        // Да я знаю, что это очень плохая идея так делать
                        for (let j in options.buttons) {
                            if (options.buttons.hasOwnProperty(j)) {
                                if (options.buttons[j].hasOwnProperty('onClick')) {
                                    if (e.target === _dom.find('#modal-button-' + j)[0]) {
                                        e.modal = output;
                                        options.buttons[j].onClick(e);
                                    }
                                }
                            }
                        }
                    });

                    _cache.modal = output;
                    return output;
                }
            },

            // Создание книги, создает новый элемент на странице
            createBook: function(bookObject, checkValidation) {
                if (bookObject) {
                    if (checkValidation) {
                        if (!_this.methods.checkInputValidation()) {
                            return false;
                        }
                    }

                    const cacheID = helpers.hash.guid();
                    const template = _view.fill('book', {
                        name: helpers.text.truncate(helpers.escape.getText(bookObject.name), 35),
                        author: helpers.text.truncate(helpers.escape.getText(bookObject.author), 75),
                    });
                    const book = _dom.createElement(template);

                    book.addEventListener('EVENT_BOOK_EDIT', function(e) {
                        e.stopPropagation();

                        _dom.removeClass(_cache.elements.input_name, 'sidebar-input-error');
                        _dom.removeClass(_cache.elements.input_author, 'sidebar-input-error');
                        _dom.removeClass(_cache.elements.input_date, 'sidebar-input-error');
                        _dom.removeClass(_cache.elements.input_count, 'sidebar-input-error');

                        _this.methods.editBook(_cache.books[cacheID]);
                    });

                    book.addEventListener('EVENT_BOOK_REMOVE', function(e) {
                        e.stopPropagation();
                        const bookObject = _cache.books[cacheID];

                        _this.methods.showModal({
                            title: 'Удаление',
                            text: `Вы действительно хотите удалить <b>«${bookObject.name}»</b> от <b>${bookObject.author}</b>?`,
                            buttons: [
                                {
                                    type: 'modal-button-2',
                                    text: 'Отменить',
                                    onClick: function(e) {
                                        e.modal.close();
                                    }
                                },
                                {
                                    type: 'modal-button-2',
                                    color: 'button-red',
                                    text: 'Удалить',
                                    onClick: function(e) {
                                        _dom.removeWithAnimation(bookObject.parent, 'animation-fade-out', function() {
                                            _storage.remove(cacheID);
                                            delete _cache.books[cacheID];
                                            _this.methods.checkIfBooksEmpty();
                                        });

                                        e.modal.close();
                                    }
                                }
                            ]
                        });
                    });

                    const toSave = {
                        ...bookObject,
                        id: cacheID,
                        updated_at: helpers.time.getTimestamp(),
                        created_at: helpers.time.getTimestamp()
                    };

                    _cache.books[cacheID] = {
                        ...toSave,
                        parent: book
                    };

                    _cache.elements.books.appendChild(book);

                    _storage.set(cacheID, toSave);

                    _this.methods.setDefaultSidebar();
                    _this.methods.checkIfBooksEmpty();
                }
            },

            // Сохранение изменений, изменяет элемент на странице
            saveBook: function(bookObject, cacheID, checkValidation) {
                if (bookObject) {
                    if (checkValidation) {
                        if (!_this.methods.checkInputValidation()) {
                            return false;
                        }
                    }

                    if (_cache.books.hasOwnProperty(cacheID)) {
                        const name = _dom.find('.book-name', bookObject.parent)[0];
                        const author = _dom.find('.book-author', bookObject.parent)[0];

                        if (name && author) {
                            name.innerHTML = helpers.text.truncate(helpers.escape.getText(bookObject.name), 35);
                            author.innerHTML = helpers.text.truncate(helpers.escape.getText(bookObject.author), 75);

                            _cache.books[cacheID].name = helpers.escape.getText(bookObject.name);
                            _cache.books[cacheID].author = helpers.escape.getText(bookObject.author);
                            _cache.books[cacheID].date = bookObject.date;
                            _cache.books[cacheID].count = bookObject.count;
                            _cache.books[cacheID].updated_at = helpers.time.getTimestamp();

                            const toSave = _cache.books[cacheID];
                            delete toSave.parent;
                            _storage.set(cacheID, toSave);
                        }
                    }

                    _this.methods.setDefaultSidebar();
                    _this.methods.checkIfBooksEmpty();
                }
            },

            // Старт редактирования книги, сайдбар заполняется нужными данными
            editBook: function(bookObject) {
                if (bookObject) {
                    _dom.addClass(_cache.elements.sidebar, 'sidebar-editable');

                    _cache.elements.input_name.value = bookObject.name;
                    _cache.elements.input_author.value = bookObject.author;
                    _cache.elements.input_date.value = bookObject.date;
                    _cache.elements.input_count.value = bookObject.count;

                    const editable = _dom.find('.book-editable')[0];
                    if (editable) {
                        _dom.removeClass(editable, 'book-editable');
                    }

                    _cache.editable = bookObject.id;

                    _dom.addClass(bookObject.parent, 'book-editable');
                }
            },

            // Проверка на наличие книг, если нет, то показываем на странице сообщение о том, что можно добавить
            checkIfBooksEmpty: function() {
                if (Object.keys(_cache.books).length) {
                    _dom.hide(_cache.elements.content_empty);
                    _dom.show(_cache.elements.books);
                } else {
                    _dom.hide(_cache.elements.books);
                    _dom.show(_cache.elements.content_empty);
                }
            },

            // Сброс сайдбара к созданию новой книги
            setDefaultSidebar: function() {
                _cache.editable = null;

                _cache.elements.input_name.value = '';
                _cache.elements.input_author.value = '';
                _cache.elements.input_date.value = '';
                _cache.elements.input_count.value = '';

                const editable = _dom.find('.book-editable')[0];
                if (editable) {
                    _dom.removeClass(editable, 'book-editable');
                }

                _dom.removeClass(_cache.elements.sidebar, 'sidebar-editable');
            }
        };
    };

    document.addEventListener('DOMContentLoaded', function() {
        const application = (new Application()).init();
        const isTest = window.location.search.indexOf('test=1') >= 0;

        if (isTest) {
            application.methods.createBook({
                name: 'Война и мир',
                author: 'Лев Толстой',
                date: 1869,
                count: 1869
            });
            application.methods.createBook({
                name: '1984',
                author: 'Джордж Оруэлл',
                date: 1949,
                count: 1949
            });
            application.methods.createBook({
                name: 'Кентерберийские рассказы',
                author: 'Джоффри Чосер',
                date: 1813,
                count: 1813
            });
            application.methods.createBook({
                name: 'Лев, колдунья и платяной шкаф',
                author: 'Клайв Льюис',
                date: 1950,
                count: 1950
            });
            application.methods.createBook({
                name: 'Джон Кейнс',
                author: 'Общая теория занятости, процента и денег',
                date: 1936,
                count: 1936
            });
            application.methods.createBook({
                name: 'Лев Толстой',
                author: 'Анна Каренина',
                date: 1877,
                count: 1877
            });
        }
    });
})();