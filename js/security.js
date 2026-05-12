/**
 * A23Games - Robust Content Protection Script
 * Prevents unauthorized copying, asset inspection, and basic code theft.
 */

(function() {
    'use strict';

    // 1. Disable Right-Click Context Menu
    document.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        // console.log('%c Security Alert: Right-click is disabled to protect game assets.', 'color: red; font-weight: bold; font-size: 14px;');
    });

    // 2. Optional: do not block DevTools shortcuts so you can press F12 / Ctrl+Shift+I to debug.

    // 3. Disable Text Selection (redundant with CSS but good for safety)
    document.addEventListener('selectstart', function(e) {
        e.preventDefault();
    });

    // 4. Disable Image/Asset Dragging
    document.addEventListener('dragstart', function(e) {
        e.preventDefault();
    });

    // 5. Console Warning for deterring beginners
    console.log("%c STOP! %c If someone told you to copy/paste something here, it's a scam.", "color: red; font-size: 40px; font-weight: bold; -webkit-text-stroke: 1px black;", "font-size: 20px;");
    console.log("%c This area is for developers. Unauthorized access or code theft is prohibited. %c A23Games Security Subsystem Active.", "font-size: 16px;", "color: green; font-weight: bold;");

    // 6. Basic Debugger Trap
    // Periodically triggers a 'debugger' pause if DevTools is actually open.
    // This makes the console unusable for some browsers.
    /*
    setInterval(function() {
        (function() {
            return false;
        }['constructor']('debugger')['call']());
    }, 1000);
    */

})();
