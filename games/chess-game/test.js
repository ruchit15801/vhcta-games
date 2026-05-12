const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');
const script = fs.readFileSync('js/script.js', 'utf8');

const dom = new JSDOM(html, { runScripts: "dangerously", url: "http://localhost/" });
const window = dom.window;

// polyfill
window.AudioContext = class {
    createOscillator() { return { frequency: {setValueAtTime:()=>{}}, connect: ()=>{}, start: ()=>{}, stop: ()=>{} } }
    createGain() { return { gain: {setValueAtTime:()=>{}, exponentialRampToValueAtTime:()=>{}}, connect: ()=>{} } }
};
window.webkitAudioContext = window.AudioContext;

const s = window.document.createElement('script');
s.textContent = script;
window.document.body.appendChild(s);

// Trigger a select
setTimeout(() => {
    try {
        console.log('triggering move');
        window.handleSquareClick(6, 4); // click e2
        setTimeout(() => {
            console.log('board kids:', window.document.getElementById('chess-board').children.length);
            console.log('pieces layer kids:', window.document.getElementById('pieces-layer').children.length);
            console.log('done');
        }, 1000);
    } catch (e) {
        console.error("ERROR", e.message, e.stack);
    }
}, 500);
