// LOCAL STORAGE UTILITIES

export function getLocalStorage(storageName : string, defaultObj : any) : any {
    let savedData : any;
    try {   
        savedData = JSON.parse(localStorage.getItem(storageName) as string);
    }
    catch {
        savedData = null;
    }
    if (savedData == null) {
        return defaultObj;
    }
    return savedData;
}

export function setLocalStorage(storageName : string, obj : any) : boolean {
    try {
        localStorage.setItem(storageName, JSON.stringify(obj));     
    }
    catch {
        return false;
    }
    return true;
}

export function deleteLocalStorage(storageName : string) : void {
    try {
        localStorage.removeItem(storageName);
    }
    catch {}
}