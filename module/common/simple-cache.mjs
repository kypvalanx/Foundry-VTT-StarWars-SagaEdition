export class SimpleCache {

    lazyResolve = {}

    getCached(key, fn) {
        if(key instanceof Object){
            let strKey = ""
            for(const property in key){
                strKey += `#${property}->${key[property]}#`
            }
            key = strKey;
        }
        if (!this.lazyResolve[key]) {
            this.lazyResolve[key] = fn();
        }
        return this.lazyResolve[key];
    }
}