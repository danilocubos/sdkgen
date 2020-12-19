# Releases

## 1.4.1 (2020-11-30)

**Correções**

- Correção de regressão na versão 1.4.0 em que o brower-runtime não retornava o conteúdo da resposta em caso de sucesso.
- Suporte ao tipo primitivo `email` no Swagger gerado para funções `@rest` ([#140](https://github.com/sdkgen/sdkgen/pull/140)).
- Correção de exemplo na documentação ([#137](https://github.com/sdkgen/sdkgen/pull/137)).

## 1.4.0 (2020-11-19)

**Documentação! ([#120](https://github.com/sdkgen/sdkgen/pull/120))**

Temos agora uma documentação nova e escrita em português para o sdkgen. Ainda será foco das próximas releases para garantir que contenha toda a informação necessária para utilizar a manipular o sdkgen. Contribuições serão sempre bem-vindas.

Confira em: https://sdkgen.github.io

**Dados adicionais em erros ([#133](https://github.com/sdkgen/sdkgen/pull/133))**

No sdkgen sempre foi possível definir tipos de erro:

```
error InvalidArgument
```

Agora é possível incluir dados adicionais (de qualquer tipo) junto com um erro:

```
error InvalidArgument {
  argumentName: string
  reason: string
}
```

E o erro pode ser lançado como:

```
throw new InvalidArgument("Argumento inválido!", { argumentName: "amount", reason: "Deve ser positivo" });
```

Qualquer tipo pode ser utilizado, como por exemplo:

```
error NoFunds uint?
```

**Outras mudanças**

- Lançamento de erros no Node.js deve ser feito através de `throw new SomeError("message")` em vez do `api.err.SomeError("message")`. A forma anterior ainda está disponível, mas produzirá um warning. ([#122](https://github.com/sdkgen/sdkgen/pull/122))
- CLI está mais amigável com `--help` melhorado, inclusive no modo de checagem de compatibilidade `sdkgen compatibility --help`. ([#131](https://github.com/sdkgen/sdkgen/pull/131))
- Suporte ao tipo `xml` no retorno de chamadas REST. ([#132](https://github.com/sdkgen/sdkgen/pull/132))
- .NET 5.0 incluído no CI. ([#135](https://github.com/sdkgen/sdkgen/pull/135))
- Atualização de dependências.

**Correções**

- Informações do dispositivo Android e iOS agora são corretamente reportadas no Flutter. ([#126](https://github.com/sdkgen/sdkgen/pull/126))
- Coloração de sintaxe corrigida para `@description` e `@arg` com múltiplas linhas no VSCode. ([#128](https://github.com/sdkgen/sdkgen/pull/128))
- Correção no código de status HTTP em requisições REST em caso de erro Fatal. ([#130](https://github.com/sdkgen/sdkgen/pull/130))
- Correção no envio do tipo `bytes` como argumento de uma função no Android. ([#134](https://github.com/sdkgen/sdkgen/pull/134))
