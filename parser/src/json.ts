import {
  ArrayType,
  AstRoot,
  DescriptionAnnotation,
  EnumType,
  EnumValue,
  ErrorNode,
  Field,
  FunctionOperation,
  HiddenAnnotation,
  Operation,
  OptionalType,
  RestAnnotation,
  StructType,
  ThrowsAnnotation,
  Type,
  TypeDefinition,
  TypeReference,
  VoidPrimitiveType,
} from "./ast";
import { analyse } from "./semantic/analyser";
import { primitiveToAstClass } from "./utils";

interface TypeTable {
  [name: string]: TypeDescription;
}

interface FunctionTable {
  [name: string]: {
    args: {
      [arg: string]: TypeDescription;
    };
    ret: TypeDescription;
  };
}

export type TypeDescription = string | string[] | { [name: string]: TypeDescription };

interface AnnotationJson {
  type: string;
  value: any;
}

export interface AstJson {
  typeTable: TypeTable;
  functionTable: FunctionTable;
  errors: Array<string | string[]>;
  annotations: { [target: string]: AnnotationJson[] };
}

export function astToJson(ast: AstRoot): AstJson {
  const annotations: { [target: string]: AnnotationJson[] } = {};
  const typeTable: TypeTable = {};

  for (const { name, fields } of ast.structTypes) {
    typeTable[name] = {};
    const obj: any = typeTable[name];

    for (const field of fields) {
      obj[field.name] = field.type.name;

      for (const ann of field.annotations) {
        if (ann instanceof DescriptionAnnotation) {
          const target = `type.${name}.${field.name}`;

          annotations[target] ||= [];
          const list = annotations[target];

          list.push({ type: "description", value: ann.text });
        }
      }
    }
  }

  for (const { name, values } of ast.enumTypes) {
    typeTable[name] = values.map(v => v.value);
  }

  const functionTable: FunctionTable = {};

  for (const op of ast.operations) {
    const args: any = {};

    for (const arg of op.args) {
      args[arg.name] = arg.type.name;
      for (const ann of arg.annotations) {
        if (ann instanceof DescriptionAnnotation) {
          const target = `fn.${op.prettyName}.${arg.name}`;

          annotations[target] ||= [];
          const list = annotations[target];

          list.push({ type: "description", value: ann.text });
        }
      }
    }

    functionTable[op.prettyName] = {
      args,
      ret: op.returnType.name,
    };

    for (const ann of op.annotations) {
      const target = `fn.${op.prettyName}`;

      annotations[target] ||= [];
      const list = annotations[target];

      if (ann instanceof DescriptionAnnotation) {
        list.push({ type: "description", value: ann.text });
      }

      if (ann instanceof ThrowsAnnotation) {
        list.push({ type: "throws", value: ann.error });
      }

      if (ann instanceof RestAnnotation) {
        list.push({
          type: "rest",
          value: {
            bodyVariable: ann.bodyVariable,
            headers: [...ann.headers.entries()],
            method: ann.method,
            path: ann.path,
            pathVariables: ann.pathVariables,
            queryVariables: ann.queryVariables,
          },
        });
      }

      if (ann instanceof HiddenAnnotation) {
        list.push({ type: "hidden", value: null });
      }
    }
  }

  const errors = ast.errors.map(error => (error.dataType instanceof VoidPrimitiveType ? error.name : [error.name, error.dataType.name]));

  return {
    annotations,
    errors,
    functionTable,
    typeTable,
  };
}

export function jsonToAst(json: AstJson): AstRoot {
  const operations: Operation[] = [];
  const typeDefinition: TypeDefinition[] = [];

  function processType(description: TypeDescription, typeName?: string): Type {
    if (typeof description === "string") {
      const primitiveClass = primitiveToAstClass.get(description);

      if (primitiveClass) {
        return new primitiveClass();
      } else if (description.endsWith("?")) {
        return new OptionalType(processType(description.slice(0, description.length - 1)));
      } else if (description.endsWith("[]")) {
        return new ArrayType(processType(description.slice(0, description.length - 2)));
      }

      return new TypeReference(description);
    } else if (Array.isArray(description)) {
      return new EnumType(description.map(v => new EnumValue(v)));
    }

    const fields: Field[] = [];

    for (const fieldName of Object.keys(description)) {
      const field = new Field(fieldName, processType(description[fieldName]));

      if (typeName) {
        const target = `type.${typeName}.${fieldName}`;

        for (const annotationJson of json.annotations[target] || []) {
          if (annotationJson.type === "description") {
            field.annotations.push(new DescriptionAnnotation(annotationJson.value));
          }
        }
      }

      fields.push(field);
    }

    return new StructType(fields, []);
  }

  for (const [typeName, description] of Object.entries(json.typeTable)) {
    const type = processType(description, typeName);

    typeDefinition.push(new TypeDefinition(typeName, type));
  }

  for (const [functionName, func] of Object.entries(json.functionTable)) {
    const args = Object.keys(func.args).map(argName => {
      const field = new Field(argName, processType(func.args[argName]));
      const target = `fn.${functionName}.${argName}`;

      for (const annotationJson of json.annotations[target] || []) {
        if (annotationJson.type === "description") {
          field.annotations.push(new DescriptionAnnotation(annotationJson.value));
        }
      }

      return field;
    });

    const op = new FunctionOperation(functionName, args, processType(func.ret));
    const target = `fn.${functionName}`;

    for (const annotationJson of json.annotations[target] || []) {
      if (annotationJson.type === "description") {
        op.annotations.push(new DescriptionAnnotation(annotationJson.value));
      } else if (annotationJson.type === "throws") {
        op.annotations.push(new ThrowsAnnotation(annotationJson.value));
      } else if (annotationJson.type === "rest") {
        const { method, path, pathVariables, queryVariables, headers, bodyVariable } = annotationJson.value;

        op.annotations.push(new RestAnnotation(method, path, pathVariables, queryVariables, new Map(headers), bodyVariable));
      } else if (annotationJson.type === "hidden") {
        op.annotations.push(new HiddenAnnotation());
      }
    }

    operations.push(op);
  }

  const errors = (json.errors || []).map(error => {
    if (Array.isArray(error)) {
      return new ErrorNode(error[0], processType(error[1]));
    }

    return new ErrorNode(error as string, new VoidPrimitiveType());
  });

  const ast = new AstRoot(typeDefinition, operations, errors);

  analyse(ast);
  return ast;
}
