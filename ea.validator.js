/* 
	The validator is called from ea.js and validates input to the adapter and output from the api
	using the parameter settings in ./json/ea.config.json. 
*/

module.exports = class Validator {

	#intersect = (a1, a2) => {
		const rv = a1.filter(v => a2.includes(v));
		return rv.length>0 ?rv :undefined;
	}

  	validate (provided, required) {
	    return Object.keys(required).reduce((m,key)=>{
	        let matched = this.#intersect(required[key].aka, Object.keys(provided));
	        if (matched){	        	
	        	m.params[key] = provided[matched];
	        } else {
	        	m = { params: {}, missingKeys: [...(m.missingKeys?m.missingKeys:[]), " " + key + "(" + required[key].aka + ")"] }
	        }       
	        return m;
	    }, {params: {}});
	}  

}

