// ==UserScript==
// @name         JIRA insights
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  calls local info about the task
// @author       You
// @match        https://tinypass.atlassian.net/browse/*
// @icon         data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// @grant        GM_addStyle
// @require      https://ajax.googleapis.com/ajax/libs/jquery/3.4.1/jquery.min.js
// @require      https://gist.github.com/raw/2625891/waitForKeyElements.js
// ==/UserScript==

(function() {
    'use strict';

    const FAKE_ID = 'custom_insights_button_ru';

    waitForKeyElements (
        '<div class="sc-1njt3iw-0 klZhqF">',
        appendAirtableButton
    );
        
    async function appendAirtableButton() {
        const customButton = document.getElementById(FAKE_ID);
        if (customButton != null) {
            return;
        }
        let issueNumberContainer = document.querySelector('[data-testid="issue.views.issue-base.foundation.breadcrumbs.breadcrumb-current-issue-container"]');
        if (issueNumberContainer != null) {
            let issueNumberContainerParent = issueNumberContainer.parentNode;
            let insightsContainer = document.createElement('div');
            insightsContainer.setAttribute('id', FAKE_ID); // insert unique div to prevent duplicated execution
            insightsContainer.setAttribute('class', 'sc-1tohg2d-1 diRGjn');
            issueNumberContainerParent.appendChild(insightsContainer);

            const style = await getStyle();
            let insightsButton = document.createElement('button');
            insightsButton.setAttribute('class', style); // copied from button in the same screen
            insightsButton.setAttribute('type', 'button');
            insightsButton.innerHTML += '<p>?</p>';
            // insightsButton.innerHTML += '<svg width="15" height="15" viewBox="0 -3 24 24" role="presentation"><g fill="currentColor"><path d="M19.005 19c-.003 0-.005.002-.005.002l.005-.002zM5 19.006c0-.004-.002-.006-.005-.006H5v.006zM5 4.994V5v-.006zM19 19v-6h2v6.002A1.996 1.996 0 0119.005 21H4.995A1.996 1.996 0 013 19.006V4.994C3 3.893 3.896 3 4.997 3H11v2H5v14h14zM5 4.994V5v-.006zm0 14.012c0-.004-.002-.006-.005-.006H5v.006zM11 5H5v14h14v-6h2v6.002A1.996 1.996 0 0119.005 21H4.995A1.996 1.996 0 013 19.006V4.994C3 3.893 3.896 3 4.997 3H11v2zm8 0v3a1 1 0 002 0V4a1 1 0 00-1-1h-4a1 1 0 000 2h3z"></path><path d="M12.707 12.707l8-8a1 1 0 10-1.414-1.414l-8 8a1 1 0 001.414 1.414z"></path></g></svg>';
            insightsButton.addEventListener('click', () => openInsightsPopup(style));
            insightsContainer.appendChild(insightsButton);
        }
    }
    
    async function getStyle() {
        let style = 'css-1979g2e'; // fallback style
        const addButton = document.querySelector('[data-testid="issue-view-foundation.quick-add.quick-add-items-compact.add-button-dropdown--trigger"]');
        if (addButton != null) {
            style = addButton.getAttribute('class');
        }
        return style;
    }

    async function handleButtonClick(lang, full, jiraKey, buttonsContainer, responseContainer) {
        buttonsContainer.remove();
        responseContainer.style.display = 'block';
        
        const loadingText = lang === 'ru' ? 'Загрузка...' : 'Loading...';
        responseContainer.innerHTML = `<div style="text-align: center; padding: 20px;"><div style="border: 3px solid #f3f3f3; border-top: 3px solid #3498db; border-radius: 50%; width: 30px; height: 30px; animation: spin 1s linear infinite; margin: 0 auto;"></div><p>${loadingText}</p></div>`;
        
        const spinnerStyle = document.createElement('style');
        spinnerStyle.textContent = '@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }';
        document.head.appendChild(spinnerStyle);
        
        try {
            const response = await fetch(`http://localhost:7900/claude?lang=${lang}&full=${full}&prompt=${jiraKey}`);
            const text = await response.text();
            responseContainer.innerHTML = `<pre style="white-space: pre-wrap; margin: 0;">${text}</pre>`;
        } catch (error) {
            const errorText = lang === 'ru' ? 'Ошибка' : 'Error';
            responseContainer.innerHTML = `<p style="color: red;">${errorText}: ${error.message}</p>`;
        }
    }

    function openInsightsPopup(style) {
        const existingPopup = document.getElementById('insights-popup');
        if (existingPopup) {
            existingPopup.remove();
        }

        const overlay = document.createElement('div');
        overlay.id = 'insights-popup';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
            z-index: 10000;
            display: flex;
            justify-content: center;
            align-items: center;
        `;

        const popup = document.createElement('div');
        popup.style.cssText = `
            width: 85%;
            height: 85%;
            background-color: white;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            position: relative;
            padding: 20px;
            box-sizing: border-box;
            overflow: auto;
        `;

        const closeButton = document.createElement('button');
        closeButton.innerHTML = '×';
        closeButton.style.cssText = `
            position: absolute;
            top: 10px;
            right: 15px;
            background: none;
            border: none;
            font-size: 24px;
            cursor: pointer;
            color: #666;
            padding: 0;
            width: 30px;
            height: 30px;
            display: flex;
            align-items: center;
            justify-content: center;
        `;

        const jiraKey = window.location.pathname.split('/browse/')[1]?.split('?')[0] || 'Unknown';
        const content = document.createElement('div');
        let innerHTML = '<h2>JIRA Insights</h2>';
        if (jiraKey == 'Unknown')
            innerHTML += 'Failed to get JIRA ticket number';

        content.innerHTML = innerHTML;
        
        const buttonsContainer = document.createElement('div');
        buttonsContainer.style.cssText = `
            display: flex;
            gap: 10px;
            margin-top: 20px;
        `;
        
        const responseContainer = document.createElement('div');
        responseContainer.id = 'response-container';
        responseContainer.style.cssText = `
            margin-top: 20px;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
            background-color: #f9f9f9;
            height: calc(100% - 120px);
            overflow-y: auto;
            display: none;
        `;
        content.appendChild(responseContainer);

        if (jiraKey != 'Unknown') {
            const button1 = document.createElement('button');
            button1.setAttribute('class', style);
            button1.setAttribute('type', 'button');
            button1.style.width = 'auto';
            button1.innerHTML = '<p>&nbsp;&nbsp;Short insights in Russian&nbsp;&nbsp;</p>';
            
            button1.addEventListener('click', () => handleButtonClick('ru', false, jiraKey, buttonsContainer, responseContainer));
            
            const button2 = document.createElement('button');
            button2.setAttribute('class', style);
            button2.setAttribute('type', 'button');
            button2.style.width = 'auto';
            button2.innerHTML = '<p>&nbsp;&nbsp;Full insights in Russian (wait longer)&nbsp;&nbsp;</p>';
            button2.addEventListener('click', () => handleButtonClick('ru', true, jiraKey, buttonsContainer, responseContainer));
            
            const button3 = document.createElement('button');
            button3.setAttribute('class', style);
            button3.setAttribute('type', 'button');
            button3.style.width = 'auto';
            button3.innerHTML = '<p>&nbsp;&nbsp;Short insights in English&nbsp;&nbsp;</p>';
            button3.addEventListener('click', () => handleButtonClick('en', false, jiraKey, buttonsContainer, responseContainer));
            
            const button4 = document.createElement('button');
            button4.setAttribute('class', style);
            button4.setAttribute('type', 'button');
            button4.style.width = 'auto';
            button4.innerHTML = '<p>&nbsp;&nbsp;Full insights in English (wait longer)&nbsp;&nbsp;</p>';
            button4.addEventListener('click', () => handleButtonClick('en', true, jiraKey, buttonsContainer, responseContainer));
            
            buttonsContainer.appendChild(button1);
            buttonsContainer.appendChild(button2);
            buttonsContainer.appendChild(button3);
            buttonsContainer.appendChild(button4);
            content.appendChild(buttonsContainer);
        }

        closeButton.addEventListener('click', () => {
            overlay.remove();
        });

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.remove();
            }
        });

        popup.appendChild(closeButton);
        popup.appendChild(content);
        overlay.appendChild(popup);
        document.body.appendChild(overlay);
    }
})();