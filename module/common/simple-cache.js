export class SimpleCache {

    lazyResolve = new Map()

    getCached(key, fn) {
        if(key instanceof Object){
            let strKey = ""
            for(const property in key){
                strKey += `#${property}->${key[property]}#`
            }
            key = strKey;
        }
        if (this.lazyResolve.has(key)) {
            return this.lazyResolve.get(key);
        }
        let resolved = fn();
        this.lazyResolve.set(key, resolved);
        return resolved
    }
}