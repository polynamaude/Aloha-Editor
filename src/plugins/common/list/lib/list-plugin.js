/* list-plugin.js is part of Aloha Editor project http://aloha-editor.org
 *
 * Aloha Editor is a WYSIWYG HTML5 inline editing library and editor.
 * Copyright (c) 2010-2012 Gentics Software GmbH, Vienna, Austria.
 * Contributors http://aloha-editor.org/contribution.php
 *
 * Aloha Editor is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or any later version.
 *
 * Aloha Editor is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA 02110-1301, USA.
 *
 * As an additional permission to the GNU GPL version 2, you may distribute
 * non-source (e.g., minimized or compacted) forms of the Aloha-Editor
 * source code without the copy of the GNU GPL normally required,
 * provided you include this license notice and a URL through which
 * recipients can access the Corresponding Source.
 */
define([
	'aloha',
	'jquery',
	'aloha/plugin',
	'util/dom',
	'ui/ui',
	'ui/scopes',
	'ui/button',
	'ui/toggleButton',
    'ui/menuButton',
	'i18n!list/nls/i18n',
	'i18n!aloha/nls/i18n',
	'aloha/engine',
	'PubSub'
], function(
	Aloha,
	jQuery,
	Plugin,
	Dom,
	Ui,
	Scopes,
	Button,
	ToggleButton,
	MenuButton,
	i18n,
	i18nCore,
	Engine,
	PubSub
) {
	'use strict';

	var GENTICS = window.GENTICS;

	/**
	* Small JS template function
	* @param String str The template where substitution takes place
	* @param Object obj The object containing strings to insert into template
	* @return String
	*/
	function tmpl (str, obj) {
	    var replacer = function(wholeMatch, key) {
	            return obj[key] === undefined ? wholeMatch : obj[key];
	        },
	        regexp = /\${\s*([a-z0-9\-_]+)\s*}/ig;

	    do {
	        var beforeReplace = str;
	        str = str.replace(regexp, replacer);
	        var afterReplace = str !== beforeReplace;
	    } while (afterReplace);

	    return str;
	};

	/**
	 * Transforms the given list element and its sub elements (if they are in the selection) into
	 * the given transformTo target.
	 * @param domToTransform - The list object that should be transformed
	 * @param transformTo - Transformationtarget e.g. 'ul' / 'ol'
	 */
	function transformExistingListAndSubLists (domToTransform, transformTo) {
		// find and transform sublists if they are in the selection
		jQuery(domToTransform).find(domToTransform.nodeName).each(function(){
			if (isListInSelection(this)) {
				Aloha.Markup.transformDomObject(this, transformTo, Aloha.Selection.rangeObject);
			}
		});

		// the element itself
		Aloha.Markup.transformDomObject(domToTransform, transformTo, Aloha.Selection.rangeObject);
	}

	/**
	 * Checks if a dom element is in the given Slectiontree.
	 * @param needle - the searched element
	 * @return returns true if the needle is found in the current selection tree.
	 */
	function isListInSelection(needle) {
		var selectionTree = Aloha.Selection.getSelectionTree();
		return checkSelectionTreeEntryForElement(selectionTree, needle);
	}

	/**
	 * Checks if the given needle is in the given treeElement or in one of its sub elements.
	 * @param treeElement - the tree element to be searched in
	 * @param needle - the searched element
	 */
	function checkSelectionTreeEntryForElement(treeElementArray, needle) {
		var found = false;
		jQuery.each(treeElementArray, function(index, element){
			if ((element.domobj === needle && element.selection !== "none") || checkSelectionTreeEntryForElement(element.children, needle)) {
				found = true;
			}
		});
		return found;
	}

	/**
	 * Register the ListPlugin as Aloha.Plugin
	 */
	var ListPlugin = Plugin.create('list', {
		/**
		 * default button configuration
		 */
		config: [ 'ul', 'ol', 'dl' ],

		/**
		 * List of transformable elements
		 */
		transformableElements: {'p' : true, 'h1' : true, 'h2' : true, 'h3' : true, 'h4' : true, 'h5' : true, 'h6' : true, 'ul' : true, 'ol' : true, 'dl': true},

		/**
		* Default list styles
		*/
		templates: {
			ul: {
				classes: ['aloha-list-disc', 'aloha-list-circle', 'aloha-list-square'],
				template: '<ul class="${cssClass}"><li>${first}<ul class="${cssClass}"><li>${second}<ul class="${cssClass}"><li>${third}</li></ul></li></ul></li></ul>',
				locale: {
					default: {first: 'first layer', second: 'second layer', third: 'third layer'},
					de: {first: 'erste Ebene', second: 'zweite Ebene', third: 'dritte Ebene'}
				}
			},
			ol: {
				classes: ['aloha-list-decimal', 'aloha-list-decimal-leading-zero',
					'aloha-list-lower-roman', 'aloha-list-upper-roman', 'aloha-list-lower-greek',
					'aloha-list-lower-latin', 'aloha-list-upper-latin' ],
				template: '<ol class="${cssClass}"><li>${first}<ol class="${cssClass}"><li>${second}<ol class="${cssClass}"><li>${third}</li></ol></li></ol></li></ol>',
				locale: {
					default: {first: 'first layer', second: 'second layer', third: 'third layer'},
					de: {first: 'erste Ebene', second: 'zweite Ebene', third: 'dritte Ebene'}
				}
			},
			dl: {
				classes: ['aloha-list-blue', 'aloha-list-green', 'aloha-list-red'],
				template: '<dl class="${cssClass}"><dt>${first}<dt><dd>${second}</dd></dl>',
				locale: {
					default: {first: 'first item', second: 'second item'},
					de: {first: 'erstes Element', second: 'zweites Element'}
				}
			},
		},

		/**
		 * Toggle selected CSS class on current list elemnet
		 * @param String listtype: ol, ul or dl
		 * @param String style: selected CSS class
		 * @return void
		 */
		toggleListStyle: function(listtype, style) {
			var domObject = this.getStartingDomObjectToTransform();
			var nodeName = domObject.nodeName.toLowerCase();
			var listToStyle =  jQuery(domObject);
			var remove = false;

			if (nodeName !== 'ul' && nodeName !== 'ol' && nodeName !== 'dl') {
				// we don't have a list yet, so transform selection to list
				this.transformList(listtype);
				domObject = this.getStartingDomObjectToTransform();
				nodeName = domObject.nodeName.toLowerCase();
				listToStyle = jQuery(this.getStartingDomObjectToTransform());
			}

			if(listtype === nodeName){
				// remove all classes
				jQuery.each(this.templates[nodeName].classes, function(){
					if(listToStyle.hasClass(this.cssClass) && this.cssClass === style){
						remove = true;
					}
					listToStyle.removeClass(this.cssClass);
				});

				if(!remove){
					listToStyle.addClass(style);
				}
			}
		},

		/**
		* Array for ordered list style buttons
		*/
		orderedListStyleButtons: [],

		/**
		* Array for unordered list style buttons
		*/
		unorderedListStyleButtons: [],

		/**
		* Array for unordered definition style buttons
		*/
		definitionListStyleButtons: [],

		/**
		* Construct button for list styles (CSS classes)
		* @param String listtype ol, ul or dl
		* @param String cssClass selected list style
	 	* @return Object for MenuButton menu property
		*/
		makeListStyleButton: function (listtype, cssClass) {
			var that = this;
			var lang = typeof(Aloha.settings.locale) !== 'undefined' ? Aloha.settings.locale : 'default';
			var locale = that.templates[listtype].locale[lang];
			var htmlTemplate = tmpl(that.templates[listtype].template, {cssClass: cssClass, first: locale.first, second: locale.second, third: locale.third});
			return {
				html: '<div class="aloha-list-templates">' + htmlTemplate + '</div>',
				click: function () {
					that.toggleListStyle(listtype, cssClass);
				}
			};
		},

		/**
		 * Initialize the plugin, register the buttons
		 */
		init: function() {

			var that = this;

			// List format classes can be overwritten via Aloha.settings.plugins.list.classes
			if (typeof Aloha.settings.plugins.list !== 'undefined') {
				that.templates = Aloha.settings.plugins.list.templates;
			}

			jQuery.each(that.templates.dl.classes, function (i, cssClass) {
				that.definitionListStyleButtons.push(that.makeListStyleButton('dl', cssClass));
			});

			this._definitionListFormatSelectorButton = Ui.adopt("definitionListFormatSelector", MenuButton, {
				click: function(){
					that.transformList('dl');
				},
				html: '<span class="ui-button-icon-primary ui-icon aloha-icon aloha-icon-definitionlist"></span>',
				menu: (that.definitionListStyleButtons.length) ? that.definitionListStyleButtons : null
			});

			jQuery.each(that.templates.ol.classes, function (i, cssClass) {
				that.orderedListStyleButtons.push(that.makeListStyleButton('ol', cssClass));
			});

			this._orderedListFormatSelectorButton = Ui.adopt("orderedListFormatSelector", MenuButton, {
				click: function(){
					that.transformList('ol');
				},
				html: '<span class="ui-button-icon-primary ui-icon aloha-icon aloha-icon-orderedlist"></span>',
				menu: (that.orderedListStyleButtons.length) ? that.orderedListStyleButtons : null
			});

			jQuery.each(that.templates.ul.classes, function (i, cssClass) {
				that.unorderedListStyleButtons.push(that.makeListStyleButton('ul', cssClass));
			});

			this._unorderedListFormatSelectorButton = Ui.adopt("unorderedListFormatSelector", MenuButton, {
				click: function(){
					that.transformList('ul');
				},
				html: '<span class="ui-button-icon-primary ui-icon aloha-icon aloha-icon-unorderedlist"></span>',
				menu: (that.unorderedListStyleButtons.length) ? that.unorderedListStyleButtons : null
			});

			this._indentListButton = Ui.adopt("indentList", Button, {
				tooltip: i18n.t('button.indentlist.tooltip'),
				icon: 'aloha-icon aloha-icon-indent',
				scope: 'Aloha.continuoustext',
				click: function() {
					that.indentList();
				}
			});

			this._outdentListButton = Ui.adopt("outdentList", Button, {
				tooltip: i18n.t('button.outdentlist.tooltip'),
				icon: 'aloha-icon aloha-icon-outdent',
				scope: 'Aloha.continuoustext',
				click: function() {
					that.outdentList();
				}
			});

			Scopes.createScope('Aloha.List', 'Aloha.continuoustext');

			// add the event handler for context selection change
			PubSub.sub('aloha.selection.context-change', function(message){
				var i,
					effectiveMarkup,
					rangeObject = message.range;

				// un-press all menubuttons buttons
				jQuery('.aloha-icon-unorderedlist').parents('.aloha-ui-menubutton-container').removeClass('aloha-button-active');
				jQuery('.aloha-icon-orderedlist').parents('.aloha-ui-menubutton-container').removeClass('aloha-button-active');
				jQuery('.aloha-icon-definitionlist').parents('.aloha-ui-menubutton-container').removeClass('aloha-button-active');

				// Hide all buttons in the list tab will make the list tab disappear
				that._outdentListButton.show(false);
				that._indentListButton.show(false);
				that._unorderedListFormatSelectorButton.show(false);
				that._orderedListFormatSelectorButton.show(false);
				that._definitionListFormatSelectorButton.show(false);

				for ( i = 0; i < rangeObject.markupEffectiveAtStart.length; i++) {
					effectiveMarkup = rangeObject.markupEffectiveAtStart[ i ];

					if (Aloha.Selection.standardTagNameComparator(effectiveMarkup, jQuery('<ul></ul>'))) {
						that._unorderedListFormatSelectorButton.show(true);
						// Show all buttons in the list tab
						that._outdentListButton.show(true);
						that._indentListButton.show(true);
						jQuery('.aloha-icon-unorderedlist').parent().parent().parent().parent().addClass('aloha-button-active');
						break;
					}
					if (Aloha.Selection.standardTagNameComparator(effectiveMarkup, jQuery('<ol></ol>'))) {
						that._orderedListFormatSelectorButton.show(true);
						// Show all buttons in the list tab
						that._outdentListButton.show(true);
						that._indentListButton.show(true);
						jQuery('.aloha-icon-orderedlist').parent().parent().parent().parent().addClass('aloha-button-active');
						break;
					}
					if (Aloha.Selection.standardTagNameComparator(effectiveMarkup, jQuery('<dl></dl>'))) {
						that._definitionListFormatSelectorButton.show(true);
						jQuery(effectiveMarkup).addClass('alohafocus');
						jQuery('.aloha-icon-definitionlist').parent().parent().parent().parent().addClass('aloha-button-active');
						break;
					}
				}

				if (Aloha.activeEditable) {
					that.applyButtonConfig(Aloha.activeEditable.obj);
				}

				// Remove jQuery UI menu classes/attributes
				// from list-templates in submenus.
			    jQuery('div.aloha-list-templates ul')
					.removeClass( "ui-menu ui-widget ui-widget-content ui-corner-all")
					.attr('role', '')
					.attr('aria-hidden', '')
					.attr('aria-expanded', '')
					.css('display', 'block');
			});

			// add the key handler for Tab
			Aloha.Markup.addKeyHandler(9, function(event) {
				return that.processTab(event);
			});
		},

		/**
		 * Applys a configuration specific for an editable
		 * buttons not available in this configuration are hidden
		 * @param {jQuery} obj jQuery object of the activated editable
		 */
		applyButtonConfig: function (obj) {
			var config = this.getEditableConfig(obj);

			if (Aloha.Selection.rangeObject.unmodifiableMarkupAtStart[0]) {
				// show/hide them according to the config
				if (jQuery.inArray('ul', config) != -1 && Aloha.Selection.canTag1WrapTag2(Aloha.Selection.rangeObject.unmodifiableMarkupAtStart[0].nodeName, "ul") != -1) {
					this._unorderedListFormatSelectorButton.show(true);
				} else {
					this._unorderedListFormatSelectorButton.show(false);
				}

				if (jQuery.inArray('ol', config) != -1 && Aloha.Selection.canTag1WrapTag2(Aloha.Selection.rangeObject.unmodifiableMarkupAtStart[0].nodeName, "ol") != -1) {
					this._orderedListFormatSelectorButton.show(true);
				} else {
					this._orderedListFormatSelectorButton.show(false);
				}

				if (jQuery.inArray('dl', config) != -1 && Aloha.Selection.canTag1WrapTag2(Aloha.Selection.rangeObject.unmodifiableMarkupAtStart[0].nodeName, "dl") != -1) {
					this._definitionListFormatSelectorButton.show(true);
				} else {
					this._definitionListFormatSelectorButton.show(false);
				}
			}
		},

		/**
		 * Process Tab and Shift-Tab pressed in lists
		 */
		processTab: function (event) {
			if (event.keyCode === 9/*tab*/ ) {
				if (event.shiftKey) {
					return this.outdentList();
				} else {
					return this.indentList();
				}
			}
			return true;
		},

		/**
		 * For the current selection, get the DOM object, which will be transformed to/from the list
		 * @return dom object or false
		 */
		getStartingDomObjectToTransform: function () {
			var rangeObject = Aloha.Selection.rangeObject,
				i, effectiveMarkup;

			for ( i = 0; i < rangeObject.markupEffectiveAtStart.length; i++) {
				effectiveMarkup = rangeObject.markupEffectiveAtStart[ i ];
				if (this.transformableElements[effectiveMarkup.nodeName.toLowerCase()]) {
					return effectiveMarkup;
				}
			}

			return false;
		},

		/**
		 * For the current selection, get the nearest list item as dom object
		 * @return dom object or false
		 */
		getNearestSelectedListItem: function () {
			var rangeObject = Aloha.Selection.rangeObject,
				i, effectiveMarkup;

			for ( i = 0; i < rangeObject.markupEffectiveAtStart.length; i++) {
				effectiveMarkup = rangeObject.markupEffectiveAtStart[ i ];
				if (Dom.isListElement(effectiveMarkup)) {
					return effectiveMarkup;
				}
			}

			return false;
		},

		/**
		* Transforms a list into paragraphs
		* @param Dom domToTransform element to transform
		* @param String listElement the list element to transform (li, dt, dd)
		*/
		transformListToParagraph: function (domToTransform, listElement) {
			var newPara;
			var jqToTransform = jQuery(domToTransform);
			jQuery.each(jqToTransform.children(listElement), function(index, el) {
				newPara = Aloha.Markup.transformDomObject(el, 'p', Aloha.Selection.rangeObject);
				// if any lists are in the paragraph, move the to after the paragraph
				newPara.after(newPara.children('ol,ul,dl'));
				Engine.ensureContainerEditable(newPara.get(0));
			});

			// unwrap the elements (remove the enclosing list)
			jqToTransform.children().unwrap();
		},

		/**
		* When the list is nested into another, our list items will be
		* added to the list items of the outer list.
		* @param Dom List Dom element
		*/
		fixupNestedLists: function (jqParentList) {
				// find the place where to put the children of the inner list
				if (jqParentList.get(0).nodeName.toLowerCase() === 'li') {
					// inner list is nested in a li (this conforms to the html5 spec)
					jqParentList.after(jqList.children());
					jqList.remove();
				} else {
					// inner list is nested in the outer list directly (this violates the html5 spec)
					jqList.children().unwrap();
				}
		},

		/**
		* Creates a list out of allowed elements
		* @param String listtype type of list we want to create (ul, ol, dl)
		* @param Dom domToTransform DOM object to transform
		*/
		createList: function (listtype, domToTransform) {
			var selectedSiblings = Aloha.Selection.rangeObject.getSelectedSiblings(domToTransform);
			var jqList;
			var jqNewEl;
			var lastAppendedEl;
			var el;
			var listElement;

			// create a new list
			switch (listtype) {
				case 'ol':
					jqList = jQuery('<ol></ol>');
					jqNewEl = jQuery('<li></li>');
					break;
				case 'ul':
					jqList = jQuery('<ul></ul>');
					jqNewEl = jQuery('<li></li>');
					break;
				case 'dl':
					jqList = jQuery('<dl></dl>');
					jqNewEl = jQuery('<dt></dt>');
					break;
			}

			// add the li into the list
			jqList.append(jqNewEl);
			// append the contents of the old dom element to the li
			jQuery(domToTransform).contents().appendTo(jqNewEl);
			// replace the old dom element with the new list
			jQuery(domToTransform).replaceWith(jqList);

			// update the selection range
			if (Aloha.Selection.rangeObject.startContainer == domToTransform) {
				Aloha.Selection.rangeObject.startContainer = jqNewEl.get(0);
			}
			if (Aloha.Selection.rangeObject.endContainer == domToTransform) {
				Aloha.Selection.rangeObject.endContainer = jqNewEl.get(0);
			}

			lastAppendedEl = jqNewEl;

			// now also transform all siblings
			if (selectedSiblings) {
				var o = true;
				var lastEl = false;
				for (var i = 0; i < selectedSiblings.length; ++i) {
					if (Dom.isBlockLevelElement(selectedSiblings[i])) {
						if (lastEl) {
							lastEl = false;
						}
						// transform the block level element
						if(listtype === 'dl'){
							if(!o){
								jqNewEl = Aloha.Markup.transformDomObject(selectedSiblings[i], 'dt', Aloha.Selection.rangeObject);
							} else {
								jqNewEl = Aloha.Markup.transformDomObject(selectedSiblings[i], 'dd', Aloha.Selection.rangeObject);
							}
							o = !o;
						} else {
							jqNewEl = Aloha.Markup.transformDomObject(selectedSiblings[i], 'li', Aloha.Selection.rangeObject);
						}
						jqList.append(jqNewEl);
						lastAppendedEl = jqNewEl;
					} else {
						if (selectedSiblings[i].nodeType == 3 && jQuery.trim(selectedSiblings[i].data).length === 0) {
							continue;
						}
						if (!lastEl) {
							lastEl = jqNewEl;
							jqList.append(lastEl);
							lastAppendedEl = lastEl;
						}
						lastEl.append(selectedSiblings[i]);
					}
				}
			}

			// merge adjacent lists
			this.mergeAdjacentLists(jqList);

			//use rangy to change the selection to the contents of
			//the last li that was appended to the list
			el = lastAppendedEl.get(0);
			if (Dom.isEmpty(el)) {
				var range = Aloha.createRange();
				var selection = Aloha.getSelection();
				//IE7 requires an (empty or non-empty) text node
				//inside the li for the selection to work.
				el.appendChild(document.createTextNode(""));
				range.selectNodeContents( el.lastChild );
				selection.removeAllRanges();
				selection.addRange( range );
				Aloha.Selection.updateSelection();
			}
		},

		/**
		* Set up a new empty list
		* @param String listtype type of list we want to create (ul, ol, dl)
		* @return Dom domToTransform DOM object to transform
		*/
		prepareNewList: function (listtype) {
			var jqList;
			var jqNewEl;
			var el;
			var editable;
			var range;
			var selection;
			// wrap a paragraph around the selection
			Aloha.Selection.changeMarkupOnSelection(jQuery('<p></p>'));
			var domToTransform = this.getStartingDomObjectToTransform();

			if (!domToTransform) {
				if ( Aloha.Selection.rangeObject.startContainer.contentEditable ) {
					// create a new list with an empty item
					switch (listtype){
						case 'ol':
							jqList = jQuery('<ol></ol>');
							jqNewEl = jQuery('<li></li>');
							break;
						case 'ul':
							jqList = jQuery('<ul></ul>');
							jqNewEl = jQuery('<li></li>');
							break;
						case 'dl':
							jqList = jQuery('<dl></dl>');
							jqNewEl = jQuery('<dt></dt>');
							break;
					}

					jqList.append(jqNewEl);

					el = jqNewEl.get(0);
					editable = Aloha.getActiveEditable().obj;
					//IE7 requires an (empty or non-empty) text node
					//inside the li for the selection to work.
					el.appendChild(document.createTextNode(""));

					editable.append(jqList);
					editable.focus();

					range = Aloha.createRange();
					selection = Aloha.getSelection();
					range.setStart( el.firstChild, 0 );
					range.setEnd( el.firstChild, 0 );
					selection.removeAllRanges();
					selection.addRange( range );
					Aloha.Selection.updateSelection();
				} else {
					Aloha.Log.error(this, 'Could not transform selection into a list');
				}
			}
			return domToTransform;
		},

		/**
		 * Transform the current selection to/from a list
		 * @param String listtype type of list we want to transform to (ul, ol, dl)
		 */
		transformList: function (listtype) {
			var domToTransform = this.getStartingDomObjectToTransform();
			var jqList;
			var jqParentList;
			var	nodeName;

			// visible is set to true, but the button is not visible
			this._outdentListButton.show(true);
			this._indentListButton.show(true);

			if (!domToTransform) {
				domToTransform = this.prepareNewList(listtype);
			}

			// check the dom object
			nodeName = domToTransform.nodeName.toLowerCase();

			if (nodeName === listtype) {
				jqList = jQuery(domToTransform);
				jqParentList = jqList.parent();
				if (jqParentList.length > 0 && Dom.isListElement(jqParentList.get(0))) {
					// we are in a nested list
					this.fixupNestedLists(jqParentList);
				} else {
					// we are in an list and shall transform it to paragraphs
					if (listtype === 'dl') {
						this.transformListToParagraph(domToTransform, 'dd, dt');
					} else {
						this.transformListToParagraph(domToTransform, 'li');
					}
				}

			} else if (nodeName == 'ul' && listtype === 'ol') {
				transformExistingListAndSubLists(domToTransform, 'ol');
				this.mergeAdjacentLists(jQuery(domToTransform));
			} else if (nodeName == 'ol' && listtype === 'ul') {
				transformExistingListAndSubLists(domToTransform, 'ul');
				this.mergeAdjacentLists(jQuery(domToTransform));
			} else if (nodeName === 'ul' && listtype === 'dl') {
				this.transformListToParagraph(domToTransform, 'li');
				domToTransform = this.prepareNewList(listtype);
				this.createList(listtype, domToTransform);
			} else if (nodeName === 'ol' && listtype === 'dl') {
				this.transformListToParagraph(domToTransform, 'li');
				domToTransform = this.prepareNewList(listtype);
				this.createList(listtype, domToTransform);
			} else if (nodeName === 'dl' && listtype === 'ol' ) {
				this.transformListToParagraph(domToTransform, 'dd, dt');
				domToTransform = this.prepareNewList(listtype);
				this.createList(listtype, domToTransform);
			} else if (nodeName === 'dl' && listtype === 'ul' ) {
				this.transformListToParagraph(domToTransform, 'dd, dt');
				domToTransform = this.prepareNewList(listtype);
				this.createList(listtype, domToTransform);
			} else {
				this.createList(listtype, domToTransform);
			}

			this.refreshSelection();
		},


		/**
		 * Indent the selected list items by moving them into a new created, nested list
		 */
		indentList: function () {
			var listItem = this.getNearestSelectedListItem(),
				i, jqNewList, selectedSiblings, jqOldList, jqItemBefore;

			if (listItem) {
				jqItemBefore = jQuery(listItem).prev('li');

				// when we are in the first li of a list, there is no indenting
				if (jqItemBefore.length === 0) {
					// but we handled the TAB keystroke
					return false;
				}
				jqOldList = jQuery(listItem).parent();

				// get the also selected siblings of the dom object
				selectedSiblings = Aloha.Selection.rangeObject.getSelectedSiblings(listItem);

				// create the new list element by cloning the selected list element's parent
				jqNewList = jQuery(listItem).parent().clone(false).empty();
				jqNewList.append(listItem);

				// we found a list item before the first selected one, so append the new list to it
				jqItemBefore.append(jqNewList);

				// check for multiple selected items
				if (selectedSiblings) {
					for ( i = 0; i < selectedSiblings.length; ++i) {
						jqNewList.append(jQuery(selectedSiblings[i]));
					}
				}

				// merge adjacent lists
				this.mergeAdjacentLists(jqNewList, true);

				// refresh the selection
				this.refreshSelection();

				return false;
			}

			return true;
		},

		/**
		 * Outdent nested list items by moving them into the outer list
		 */
		outdentList: function () {
			var
				listItem = this.getNearestSelectedListItem(),
				i, jqNewPostList,
				jqListItem, jqList, jqParentList, wrappingLi,
				selectedSiblings, lastSelected;

			if (listItem) {
				// check whether the list is nested into another list
				jqListItem = jQuery(listItem);
				jqList = jqListItem.parent();

				// get the parent list
				jqParentList = jqList.parents('ul,ol');

				// check whether the inner list is directly inserted into a li element
				wrappingLi = jqList.parent('li');

				if (jqParentList.length > 0
						&& Dom.isListElement(jqParentList.get(0))) {
					// the list is nested into another list

					// get the also selected siblings of the dom object
					selectedSiblings = Aloha.Selection.rangeObject.getSelectedSiblings(listItem);

					// check for multiple selected items
					if (selectedSiblings && selectedSiblings.length > 0) {
						lastSelected = jQuery(selectedSiblings[selectedSiblings.length - 1]);
					} else {
						lastSelected = jqListItem;
					}

					// check whether we found not selected li's after the selection
					if (lastSelected.nextAll('li').length > 0) {
						jqNewPostList = jqList.clone(false).empty();
						jqNewPostList.append(lastSelected.nextAll());
						lastSelected.append(jqNewPostList);
					}

					// now move all selected li's into the higher list
					if (wrappingLi.length > 0) {
						wrappingLi.after(jqListItem);
					} else {
						jqList.before(jqListItem);
					}

					// check for multiple selected items
					if (selectedSiblings && selectedSiblings.length > 0) {
						for ( i = selectedSiblings.length - 1; i >= 0; --i) {
							jqListItem.after(jQuery(selectedSiblings[i]));
						}
					}

					// finally check whether there are elements left in the list
					if (jqList.contents('li').length === 0) {
						// list is completely empty, so remove it
						jqList.remove();
					}

					// check whether the wrapping li is empty now
					if (wrappingLi.length > 0 && wrappingLi.contents().length === 0) {
						wrappingLi.remove();
					}

					// refresh the selection
					this.refreshSelection();
				}

				return false;
			}

			return true;
		},

		/**
		 * Refresh the current selection and set to focus to the current editable again
		 */
		refreshSelection: function () {
			Aloha.Selection.rangeObject.update();
			Aloha.Selection.rangeObject.select();
			Aloha.Selection.updateSelection();
		},

		/**
		 * Merge adjacent lists (of same type) into the first list
		 * @param jqList jQuery object of a list
		 * @param allTypes true if all types of lists may be merged, false if only same types may be merged
		 */
		mergeAdjacentLists: function (jqList, allTypes) {
			// first get the first previous sibling of same type
			var firstList = jqList.get(0), jqNextList;

			while (
				firstList.previousSibling
				&& firstList.previousSibling.nodeType === 1
				&& this.isMergable(firstList.previousSibling, firstList, allTypes)
			) {
				firstList = firstList.previousSibling;
			}

			jqList = jQuery(firstList);
			// now merge all adjacent lists into this one
			while (
				firstList.nextSibling
				&& (
					(
						firstList.nextSibling.nodeType === 1
						&& this.isMergable(firstList.nextSibling, firstList, allTypes)
					) || (
						firstList.nextSibling.nodeType === 3
						&& jQuery.trim(firstList.nextSibling.data).length === 0
					)
				)
			) {
				jqNextList = jQuery(firstList.nextSibling);
				if (firstList.nextSibling.nodeType == 1) {
					jqNextList.contents().appendTo(jqList);
				}
				jqNextList.remove();
			}
		},

		/**
		 * Check whether the given DOM element toCheck is mergeable into the DOM element mergeInto
		 * @param toCheck DOM element to check
		 * @param mergeInto DOM element into which toCheck shall be merged
		 * @param allTypes true if all types of lists may be merged, false if only same types may be merged
		 */
		isMergable: function (toCheck, mergeInto, allTypes) {
			if (allTypes) {
				return toCheck.nodeName.toLowerCase() == 'ul' || toCheck.nodeName.toLowerCase() == 'ol';
			} else {
				return toCheck.nodeName == mergeInto.nodeName;
			}
		}
	});

	Engine.commands['insertdefinitionlist'] = {
		action: function(value, range) {
			ListPlugin.transformList('dl');
			if (range && Aloha.Selection.rangeObject) {
				range.startContainer = Aloha.Selection.rangeObject.startContainer;
				range.startOffset = Aloha.Selection.rangeObject.startOffset;
				range.endContainer = Aloha.Selection.rangeObject.endContainer;
				range.endOffset = Aloha.Selection.rangeObject.endOffset;
			}
		},
		indeterm: function() {
			// TODO
		},
		state: function() {
			for ( i = 0; i < rangeObject.markupEffectiveAtStart.length; i++) {
				effectiveMarkup = rangeObject.markupEffectiveAtStart[ i ];
				if (Aloha.Selection.standardTagNameComparator(effectiveMarkup, jQuery('<ul></ul>'))) {
					return false;
				}
				if (Aloha.Selection.standardTagNameComparator(effectiveMarkup, jQuery('<ol></ol>'))) {
					return false;
				}
				if (Aloha.Selection.standardTagNameComparator(effectiveMarkup, jQuery('<dl></dl>'))) {
					return true;
				}
			}

			return false;
		}
	};


	Engine.commands['insertorderedlist'] = {
		action: function(value, range) {
			ListPlugin.transformList('ol');
			if (range && Aloha.Selection.rangeObject) {
				range.startContainer = Aloha.Selection.rangeObject.startContainer;
				range.startOffset = Aloha.Selection.rangeObject.startOffset;
				range.endContainer = Aloha.Selection.rangeObject.endContainer;
				range.endOffset = Aloha.Selection.rangeObject.endOffset;
			}
		},
		indeterm: function() {
			// TODO
		},
		state: function() {
			for ( i = 0; i < rangeObject.markupEffectiveAtStart.length; i++) {
				effectiveMarkup = rangeObject.markupEffectiveAtStart[ i ];
				if (Aloha.Selection.standardTagNameComparator(effectiveMarkup, jQuery('<ul></ul>'))) {
					return false;
				}
				if (Aloha.Selection.standardTagNameComparator(effectiveMarkup, jQuery('<ol></ol>'))) {
					return true;
				}
				if (Aloha.Selection.standardTagNameComparator(effectiveMarkup, jQuery('<dl></dl>'))) {
					return false;
				}
			}

			return false;
		}
	};

	Engine.commands['insertunorderedlist'] = {
		action: function(value, range) {
			ListPlugin.transformList('ul');
			if (range && Aloha.Selection.rangeObject) {
				range.startContainer = Aloha.Selection.rangeObject.startContainer;
				range.startOffset = Aloha.Selection.rangeObject.startOffset;
				range.endContainer = Aloha.Selection.rangeObject.endContainer;
				range.endOffset = Aloha.Selection.rangeObject.endOffset;
			}
		},
		indeterm: function() {
			// TODO
		},
		state: function() {
			for ( i = 0; i < rangeObject.markupEffectiveAtStart.length; i++) {
				effectiveMarkup = rangeObject.markupEffectiveAtStart[ i ];
				if (Aloha.Selection.standardTagNameComparator(effectiveMarkup, jQuery('<ul></ul>'))) {
					return true;
				}
				if (Aloha.Selection.standardTagNameComparator(effectiveMarkup, jQuery('<ol></ol>'))) {
					return false;
				}
				if (Aloha.Selection.standardTagNameComparator(effectiveMarkup, jQuery('<dl></dl>'))) {
					return false;
				}
			}

			return false;
		}
	};

	Engine.commands['indent'] = {
		action: function(value, range) {
			ListPlugin.indentList();
			if (range && Aloha.Selection.rangeObject) {
				range.startContainer = Aloha.Selection.rangeObject.startContainer;
				range.startOffset = Aloha.Selection.rangeObject.startOffset;
				range.endContainer = Aloha.Selection.rangeObject.endContainer;
				range.endOffset = Aloha.Selection.rangeObject.endOffset;
			}
		},
		indeterm: function() {
			// TODO
		},
		state: function() {
			// TODO
			return false;
		}
	};

	Engine.commands['outdent'] = {
		action: function(value, range) {
			ListPlugin.outdentList();
			if (range && Aloha.Selection.rangeObject) {
				range.startContainer = Aloha.Selection.rangeObject.startContainer;
				range.startOffset = Aloha.Selection.rangeObject.startOffset;
				range.endContainer = Aloha.Selection.rangeObject.endContainer;
				range.endOffset = Aloha.Selection.rangeObject.endOffset;
			}
		},
		indeterm: function() {
			// TODO
		},
		state: function() {
			// TODO
			return false;
		}
	};

	/**
	 * A key handler that should be run as a keyup handler for the
	 * backspace and del keys. keyup fires after the browser has already
	 * performed the delete - this handler will perform a cleanup if
	 * necessary.
	 *
	 * Will work around an IE bug which breaks nested lists in the
	 * following situation, where [] is the selection, if backspace is
	 * pressed (same goes for the del key if the selection is at the end
	 * of the li that occurs before the selection):
	 *
	 * <ul>
	 *  <li>one</li>
	 *  <li><ul><li>two</li></ul></li>
	 * </ul>
	 * <p>[]</p>
	 *
	 * The browser behaviour, if one would presses backspace, results in
	 * the following:
	 *
	 * <ul>
	 *  <li>one</li>
	 *  <ul><li>two</li></ul>
	 * </ul>
	 *
	 * which is invalid HTML since the <ul>s are nested directly inside
	 * each other.
	 *
	 * Also, the following situation will cause the kind of invalid HTML
	 * as above.
	 * <ul>
	 *   <li>one</li>
	 *   <li><ul><li>two</li></ul></li>
	 *   <li>[]three</li>
	 * </ul>
	 *
	 * Also, the following situtation:
	 * <ul>
	 *   <li>one</li>
	 *   <li><ul><li>two</li></ul>
	 *       <p>[]three</p>
	 *       <li>four</li>
	 *   </li>
	 * </ul>
	 *
	 * And similar situations, some of which are not so easy to reproduce.
	 *
	 * @param event a jQuery key event
	 * @return false if no action needed to be taken, true if cleanup has been performed
	 */
	function deleteWorkaroundHandler(event) {
		if (8/*backspace*/ != event.keyCode && 46/*del*/ != event.keyCode) {
			return false;
		}

		var rangeObj = Aloha.getSelection().getRangeAt(0);
		var startContainer = rangeObj.startContainer;

		//the hack is only relevant if after the deletion has been
		//performed we are inside a li of a nested list
		var $nestedList = jQuery(startContainer).closest('ul, ol, dl');
		if ( ! $nestedList.length ) {
			return false;
		}
		var $parentList = $nestedList.parent().closest('ul, ol, dl');
		if ( ! $parentList.length ) {
			return false;
		}

		var ranges = Aloha.getSelection().getAllRanges();

		var actionPerformed = false;
		$parentList.each(function(){
			actionPerformed = actionPerformed || fixListNesting(jQuery(this));
		});

		if (actionPerformed) {
			Aloha.getSelection().setRanges(ranges);
			for (var i = 0; i < ranges.length; i++) {
				ranges[i].detach();
			}
		}

		return actionPerformed;
	}

	/**
	 * If dls, uls or ols are nested directly inside the given list (invalid
	 * HTML), they will be cleaned up by being appended to the preceding
	 * element.
	 */
	function fixListNesting($list) {
		var actionPerformed = false;
		$list.children('ul, ol').each(function(){
			Aloha.Log.debug("performing list-nesting cleanup");
			if ( ! jQuery(this).prev('li').append(this).length ) {
				//if there is no preceding li, create a new one and append to that
				jQuery(this).parent().prepend(document.createElement('li')).append(this);
			}
			actionPerformed = true;
		});
		$list.children('dl').each(function(){
			Aloha.Log.debug("performing list-nesting cleanup");
			if ( ! jQuery(this).prev('dt').append(this).length ) {
				//if there is no preceding dt, create a new one and append to that
				jQuery(this).parent().prepend(document.createElement('dt')).append(this);
			}
			actionPerformed = true;
		});
		return actionPerformed;
	}

	return ListPlugin;
});