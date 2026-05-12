// levels.js - Level Definitions

const baseLevels = [
    {
        id: 1,
        name: "Basic Switch",
        objective: "Connect the Switch to the Light to turn it on.",
        nodes: [
            { id: "sw1", type: "trigger", device: "switch", label: "Main Switch", x: 20, y: 50 },
            { id: "l1", type: "action", device: "light", label: "Living Room", x: 80, y: 50 }
        ],
        winCondition: (state) => state["l1"] === true
    },
    {
        id: 2,
        name: "Dual Lighting",
        objective: "Connect the Switch to BOTH lights.",
        nodes: [
            { id: "sw1", type: "trigger", device: "switch", label: "Master Switch", x: 20, y: 50 },
            { id: "l1", type: "action", device: "light", label: "Bedroom", x: 80, y: 30 },
            { id: "l2", type: "action", device: "light", label: "Bathroom", x: 80, y: 70 }
        ],
        winCondition: (state) => state["l1"] === true && state["l2"] === true
    },
    {
        id: 3,
        name: "Sensor Automation",
        objective: "Connect the Motion Sensor to the Door. (Sensor triggers automatically).",
        nodes: [
            { id: "sens1", type: "trigger", device: "sensor", label: "Motion Sensor", x: 20, y: 50, autoTrigger: true },
            { id: "d1", type: "action", device: "door", label: "Front Door", x: 80, y: 50 }
        ],
        winCondition: (state) => state["d1"] === true
    },
    {
        id: 4,
        name: "Logic: AND Gate",
        objective: "The safe should only open if BOTH switches are active. Use the AND logic node.",
        nodes: [
            { id: "sw1", type: "trigger", device: "switch", label: "Key 1", x: 20, y: 30 },
            { id: "sw2", type: "trigger", device: "switch", label: "Key 2", x: 20, y: 70 },
            { id: "and1", type: "logic", device: "and", label: "AND Gate", x: 50, y: 50 },
            { id: "d1", type: "action", device: "door", label: "Safe Door", x: 80, y: 50 }
        ],
        // The verification step will test all permutations of switches to ensure the logic is correct
        winCondition: (state) => state["d1"] === true,
        strictLogic: "AND" // Custom flag for engine to test permutations
    },
    {
        id: 5,
        name: "Logic: OR Gate",
        objective: "Turn on the Alarm if EITHER the front or back sensor detects motion.",
        nodes: [
            { id: "sens1", type: "trigger", device: "sensor", label: "Front", x: 20, y: 30, autoTrigger: true },
            { id: "sens2", type: "trigger", device: "sensor", label: "Back", x: 20, y: 70, autoTrigger: true },
            { id: "or1", type: "logic", device: "or", label: "OR Gate", x: 50, y: 50 },
            { id: "a1", type: "action", device: "alarm", label: "Alarm System", x: 80, y: 50 }
        ],
        winCondition: (state) => state["a1"] === true
    },
    {
        id: 6,
        name: "Logic: Inverter (NOT)",
        objective: "The light should be ON when the switch is OFF, and OFF when the switch is ON.",
        nodes: [
            { id: "sw1", type: "trigger", device: "switch", label: "Toggle", x: 20, y: 50 },
            { id: "not1", type: "logic", device: "not", label: "NOT Gate", x: 50, y: 50 },
            { id: "l1", type: "action", device: "light", label: "Night Light", x: 80, y: 50 }
        ],
        winCondition: (state) => state["l1"] === true, // Evaluated when switch is off
        strictLogic: "NOT"
    },
    {
        id: 7,
        name: "Security Protocol",
        objective: "Open the door if authorized switch is ON, AND alarm is OFF (requires NOT gate).",
        nodes: [
            { id: "sw1", type: "trigger", device: "switch", label: "Auth Key", x: 15, y: 30 },
            { id: "sens1", type: "trigger", device: "sensor", label: "Intruder", x: 15, y: 70, autoTrigger: true },
            { id: "not1", type: "logic", device: "not", label: "NOT Gate", x: 40, y: 70 },
            { id: "and1", type: "logic", device: "and", label: "AND Gate", x: 65, y: 50 },
            { id: "d1", type: "action", device: "door", label: "Vault", x: 85, y: 50 }
        ],
        winCondition: (state) => state["d1"] === true,
        strictLogic: "SEC"
    }
];

// Generate levels 8 through 30 programmatically to ensure 30+ levels
const levels = [...baseLevels];

for (let i = 8; i <= 30; i++) {
    const isComplex = i > 15;
    const numTriggers = Math.floor(Math.random() * 2) + 2; // 2 to 3
    const numActions = isComplex ? Math.floor(Math.random() * 2) + 2 : 1;
    
    let nodes = [];
    
    // Triggers
    for(let t=0; t<numTriggers; t++) {
        let isSensor = Math.random() > 0.5;
        nodes.push({
            id: `t${t}`,
            type: "trigger",
            device: isSensor ? "sensor" : "switch",
            label: isSensor ? `Sensor ${t+1}` : `Switch ${t+1}`,
            x: 15,
            y: 20 + (t * (80/numTriggers)),
            autoTrigger: isSensor
        });
    }

    // Logic Gates
    let numGates = isComplex ? 3 : 1;
    for(let g=0; g<numGates; g++) {
        let types = ["and", "or", "not"];
        let gType = types[Math.floor(Math.random() * types.length)];
        nodes.push({
            id: `g${g}`,
            type: "logic",
            device: gType,
            label: gType.toUpperCase() + " Gate",
            x: 40 + (g * 15),
            y: 20 + (g * 25)
        });
    }

    // Actions
    for(let a=0; a<numActions; a++) {
        let types = ["light", "door", "alarm"];
        let aType = types[Math.floor(Math.random() * types.length)];
        nodes.push({
            id: `a${a}`,
            type: "action",
            device: aType,
            label: aType.charAt(0).toUpperCase() + aType.slice(1) + ` ${a+1}`,
            x: 85,
            y: 30 + (a * 40)
        });
    }

    levels.push({
        id: i,
        name: `Sector ${i} Automation`,
        objective: `Wire the system so all action devices activate.`,
        nodes: nodes,
        winCondition: function(state) {
            // Dynamically check if all action nodes are true
            let win = true;
            for(let key in state) {
                if (key.startsWith('a') && state[key] !== true) win = false;
            }
            // Ensure at least one action is actually processed (prevents auto-win on empty)
            let hasActions = Object.keys(state).some(k => k.startsWith('a'));
            return win && hasActions;
        }
    });
}

window.gameLevels = levels;
