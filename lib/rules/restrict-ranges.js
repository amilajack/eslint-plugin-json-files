'use strict';

const path = require('path');

const defaultDependencyTypes = [
  'dependencies',
  'devDependencies',
  'optionalDependencies'
];

const packages = {
  'packages': {
    'type': 'array',
    'items': {
      'type': 'string'
    }
  }
};
const packageRegex = {
  'packageRegex': {
    'type': 'string'
  }
};
const versionHint = {
  'versionHint': {
    'enum': [
      'carat',
      'tilde',
      'pin'
    ]
  }
};
const versionRegex = {
  'versionRegex': {
    'type': 'string'
  }
};

let anyOf = [];

for (let prop1 of [packages, packageRegex]) {
  for (let prop2 of [versionHint, versionRegex]) {
    anyOf.push(Object.assign({
      'type': 'object',
      'additionalProperties': false,
      'required': Object.keys(prop2)
    }, {
      'properties': Object.assign({
        'dependencyTypes': {
          'type': 'array',
          'items': {
            'type': 'string'
          }
        }
      }, prop1, prop2)
    }));
  }
}

module.exports = {
  meta: {
    docs: {
      description: 'prevent branches in package.json dependencies'
    },
    schema: [
      {
        'oneOf': [
          {
            anyOf
          },
          {
            'type': 'array',
            'items': {
              anyOf
            }
          }
        ]
      }
    ]
  },

  create(context) {
    let filename = context.getFilename();
    if (path.basename(filename) !== 'package.json' || !context.options[0]) {
      return {};
    }

    let optionsArray = Array.isArray(context.options[0]) ? context.options[0] : context.options;

    return {
      AssignmentExpression(node) {
        for (let options of optionsArray) {
          let dependencyTypes = options.dependencyTypes || defaultDependencyTypes;
          let packages = options.packages;
          let packageRegex = new RegExp(options.packageRegex === undefined ? '.*' : options.packageRegex);
          let versionHint = options.versionHint;
          let versionRegex = new RegExp(options.versionRegex === undefined ? '.*' : options.versionRegex);

          let versionHintRegex;
          switch (versionHint) {
            case 'carat':
              versionHintRegex = /^[\^~\d]/;
              break;
            case 'tilde':
              versionHintRegex = /^[~\d]/;
              break;
            case 'pin':
              versionHintRegex = /^\d/;
              break;
            default:
              versionHintRegex = /.*/;
          }

          let json = node.right;
          for (let property of json.properties.filter(p => dependencyTypes.includes(p.key.value))) {
            let deps = property.value;
            for (let p of deps.properties) {
              let packageString = p.key.value;
              if (packages && !packages.includes(packageString)) {
                continue;
              }
              if (!packageRegex.test(packageString)) {
                continue;
              }
              let versionString = p.value.value;
              let failed;
              let message;
              if (!versionHintRegex.test(versionString)) {
                failed = true;
                message = `Invalid SemVer hint (${versionHint}).`;
              } else if (!versionRegex.test(versionString)) {
                failed = true;
                message = `Regex does not pass (${versionRegex}).`;
              }
              if (failed) {
                context.report({
                  node: p.value,
                  message
                });
              }
            }
          }
        }
      }
    };
  }
};