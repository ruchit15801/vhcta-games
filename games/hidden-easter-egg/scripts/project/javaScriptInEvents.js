

const scriptsInEvents = {

	async Logo_Event3_Act2(runtime, localVars)
	{
		fetch("file.json")
		  .then(r => r.json())
		  .then(data => {
		    console.log("Name :", data.game.gameName);
		    console.log("Description :", data.game.description);
		    console.log("Size :", data.game.size.width + " x " + data.game.size.height);
		    console.log("Orientation :", data.game.size.orientation);
		
		    console.log("Tags : " + data.game.tags.join(", ")); 
		  });
		
	}
};

globalThis.C3.JavaScriptInEvents = scriptsInEvents;
