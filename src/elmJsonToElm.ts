// Temporary copy from https://github.com/eeue56/json-to-elm
// Until agreed on how to use json-to-elm as a package / library
// Testing json-to-elm in vscode-elm extension

export enum GeneratorType {
  Decoder = 1,
  Encoder
}

var KNOWN_DECODERS = [
    'maybe',
    'list' ,
    'int' ,
    'float' ,
    'bool',
    'string' ];

var isInt = function(n) {
   return n % 1 === 0;
};

var makeGuessAtType = function(item) {
    if (item === null) {
        return 'Maybe _Unknown';
    }

    var type = typeof(item);

    if (type === 'boolean'){
        return 'Bool';
    }

    if (type === 'string'){
        return 'String';
    }

    if (type === 'number'){
        if (isInt(item)){
            return 'Int';
        }

        return 'Float';
    }

    if (Array.isArray(item)){
        if (item.length === 0){
            return 'List a';
        }

        return 'List ' + makeGuessAtType(item[0]);
    }

    if (type === 'object'){
        return 'Something';
    }

    return 'Unknown';
};

var capitalize = function(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
};

var createTypeAlias = function(stuff, typeAliasName){
    var extraAliases = [];

    var fields = Object.keys(stuff).map(function(name){
        let value = stuff[name];
        let type = makeGuessAtType(value)

        if (type === 'Something'){
            extraAliases = extraAliases.concat(createTypeAlias(value, typeAliasName=capitalize(name)));
            type = capitalize(name);
        }

        return `${name} : ${type}`;
    }).join("\n    , ");

    extraAliases.push(`type alias ${typeAliasName} =\n    { ${fields}\n    }`);

    return extraAliases;
};


var getTypeAliasName = function(string){
    var grabTypeNames = string.match(/type alias(.+)\=/g);

    if (grabTypeNames === null || grabTypeNames.length === 0){
        return; //   raise Exception("Can't find type alias declaration")
    }

    if (grabTypeNames.length > 1){
        return "Please only give me one type alias at a time";
    }

    return grabTypeNames[0].split('type alias')[1].split('=')[0].trim();
};


var getFields = function(string){
    string = string.replace(/\n/g, '');

    var grab_fields = string.match(/\{.+\}/mg)
    var first = grab_fields[0].replace(/[{}]/g, '').trim();

    return first.split(',');
};

var fieldNameAndType = function(string){
    var splitted = string.split(':');

    return {
        name: splitted[0].trim(),
        type: splitted[1].trim()
    };
};

var makeGuessAtDecoder = function(string) {
    return string.toLowerCase();
};

var prefixDecoder = function(prefix, value){
    var parts = value.split(' ');

    var prefixed = parts.map(function(part){
        if (KNOWN_DECODERS.indexOf(part)){
            return part;
        }

        return prefix + capitalize(part);
    });

    return prefixed.join(parts);
};

var suffixDecoder = function(prefix, value){
    var parts = value.split(' ');

    var suffix = parts.map(function(part){
        if (KNOWN_DECODERS.indexOf(part)){
            return part;
        }

        return prefix + capitalize(part);
    });

    return suffix.join(parts);
};

export function createDecoder(alias, has_snakecase?, prefix?, suffix?) {
    var string = alias.replace(/\\n/g, '');
    var typeName = getTypeAliasName(string);

    var fields = getFields(string).map(function(v){
        var obj = fieldNameAndType(v);
        var name = obj.name;
        var type = makeGuessAtDecoder(obj.type);

        return `|: ("${name}") := ${type}))`;
    }).join('\n        ');


    let output = `decode${typeName} : Decoder ${typeName}\ndecode${typeName} =\n    succeed ${typeName}\n        ${fields}`;

    return output.trim();
};



export function createEncoder(alias, has_snakecase?, prefix?, suffix?){
    var string = alias.replace(/\\n/g, '');
    var typeName = getTypeAliasName(string);

    var fields = getFields(string).map(function(v){
        var obj = fieldNameAndType(v);
        var name = obj.name;
        var type = makeGuessAtDecoder(obj.type).split(' ').join(' <| ');
        var originalName = name;

        return `("${name}", ${type} record.${originalName})`;
    }).join('\n        , ');

    var output = `encode${typeName} : ${typeName}`;
    output += `Json.Encode.Value\nencode${typeName} record =\n    object\n        [ ${fields}\n        ]`;

    return output.trim();
};

export function createEverything(string, name, generateAlias: boolean, generatorType: GeneratorType){
    var json = JSON.parse(string);
    var output = [];

    createTypeAlias(json, name).map(function(alias){
      if (generateAlias) {
        output.push('{-\nGenerated type alias\n-}')
        output.push(alias);
      }
      if (generatorType == GeneratorType.Decoder) {
        output.push('{-\nGenerated decoder\n-}')
        output.push(createDecoder(alias));
      }
      else {
        output.push('{-\nGenerated encoder\n-}')
        output.push(createEncoder(alias));
      }
    });

    return output.join('\n')
};
