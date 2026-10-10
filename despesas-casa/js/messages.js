// Every pt-PT UI string (Issue #3). Wording by Azulejo (Designer), handoff §4.
// Keys follow the design; `{name}` placeholders are filled by format() and
// always reach the DOM through textContent.

export const MESSAGES = Object.freeze({
  // 4.1 Fixed UI text
  'app.title': 'Despesas da casa',
  'app.tag': 'Protótipo',
  'skip': 'Saltar para o conteúdo principal',
  'notice.text': 'Os dados ficam guardados só neste navegador, neste dispositivo, e não são enviados para nenhum servidor. Isto é um protótipo: não o use para dados financeiros reais. Se limpar os dados do navegador, as despesas perdem-se.',
  'notice.label': 'Aviso sobre os dados',
  'month.nav': 'Mês',
  'month.prev': 'Mês anterior',
  'month.next': 'Mês seguinte',
  'month.current': 'Ir para o mês atual',
  'action.add': 'Registar despesa',
  'summary.h2': 'Resumo mensal',
  'summary.total': 'Total gasto',
  'summary.count.one': '{n} despesa',
  'summary.count.other': '{n} despesas',
  'summary.byCategory': 'Por categoria',
  'summary.col.category': 'Categoria',
  'summary.col.total': 'Total',
  'summary.col.percent': 'Percentagem',
  'list.h2': 'Despesas',
  'list.filter.label': 'Filtrar por categoria',
  'list.filter.all': 'Todas as categorias',
  'list.noDescription': 'Sem descrição',
  'list.noDescriptionLower': 'sem descrição',
  'list.sortHint': 'Ordenadas da mais recente para a mais antiga.',
  'row.edit': 'Editar',
  'row.delete': 'Eliminar',
  'row.hidden': ': {description}, {amount}, {date}',
  'form.addTitle': 'Registar despesa',
  'form.editTitle': 'Editar despesa',
  'form.required': 'Todos os campos são obrigatórios, exceto a descrição.',
  'form.amount': 'Valor (€)',
  'form.amountHint': 'Exemplo: 12,50',
  'form.date': 'Data',
  'form.category': 'Categoria',
  'form.categoryPlaceholder': 'Escolha uma categoria',
  'form.description': 'Descrição (opcional)',
  'form.counter': '{n} de 100 caracteres',
  'form.save': 'Guardar',
  'form.cancel': 'Cancelar',
  'settings.h2': 'Categorias e dados',
  'cat.h3': 'Categorias',
  'cat.rename': 'Mudar o nome',
  'cat.delete': 'Eliminar',
  'cat.renameLabel': 'Novo nome para «{name}»',
  'cat.reserved': 'Categoria de reserva: não pode ser eliminada.',
  'cat.newLabel': 'Nova categoria',
  'cat.add': 'Adicionar categoria',
  'data.h3': 'Dados',
  'data.sample': 'Carregar dados de exemplo',
  'data.reset': 'Eliminar todos os dados',
  'footer': 'Protótipo para testes. Os dados de exemplo são fictícios.',
  'loading': 'A carregar…',
  'noscript': 'Esta aplicação precisa de JavaScript para funcionar.',

  // 4.2 Empty states
  'empty.month': 'Ainda não há despesas em {month}.',
  'empty.list': 'Sem despesas neste mês.',
  'empty.filter': 'Não há despesas de «{category}» em {month}.',
  'empty.filterReset': 'Mostrar todas as categorias',
  'empty.firstUse': 'Comece por registar uma despesa ou experimente com dados de exemplo.',

  // 4.3 Field errors (AC2), keyed <field>.<code> as returned by validateExpense
  'amount.required': 'Indique o valor da despesa.',
  'amount.notNumber': 'Indique o valor só com algarismos e, se quiser, uma vírgula para os cêntimos (por exemplo, 1234,56).',
  'amount.tooManyDecimals': 'Use no máximo 2 casas decimais (por exemplo, 12,50).',
  'amount.notPositive': 'O valor tem de ser superior a 0,00 €.',
  'amount.tooLarge': 'O valor máximo é 999 999,99 €.',
  'date.required': 'Indique a data da despesa.',
  'date.invalid': 'Indique uma data válida.',
  'categoryId.required': 'Escolha uma categoria.',
  'categoryId.unknown': 'A categoria escolhida já não existe. Escolha outra.',
  'description.tooLong': 'A descrição pode ter no máximo 100 caracteres.',
  'form.errorSummary.one': 'Não foi possível guardar. Corrija o campo assinalado.',
  'form.errorSummary.many': 'Não foi possível guardar. Corrija os {n} campos assinalados.',

  // 4.4 Category errors (AC6)
  'category.empty': 'Indique o nome da categoria.',
  'category.tooLong': 'O nome pode ter no máximo 30 caracteres.',
  'category.duplicate': 'Já existe uma categoria com o nome «{name}».',
  'category.inUse': 'Não é possível eliminar «{name}» porque há despesas nesta categoria. Mude essas despesas para outra categoria primeiro.',
  'category.protected': 'A categoria «Outros» não pode ser eliminada.',

  // 4.5 Storage states
  'storage.unavailable': 'Não é possível guardar dados neste navegador (o armazenamento local está bloqueado ou indisponível). Pode usar a aplicação, mas tudo o que registar perde-se quando fechar ou recarregar a página.',
  'storage.quota': 'Não foi possível guardar: o espaço de armazenamento do navegador está cheio. A alteração fica visível só até recarregar a página.',
  'storage.corrupt': 'Não foi possível ler os dados guardados neste navegador. Podem estar danificados ou ser de outra versão. Não foram alterados. Para recomeçar, elimine todos os dados.',

  // 4.6 Status messages
  'status.added': 'Despesa registada.',
  'status.addedMonth': 'Despesa registada em {month}.',
  'status.edited': 'Alterações guardadas.',
  'status.editedMonth': 'Alterações guardadas. A despesa passou para {month}.',
  'status.deleted': 'Despesa eliminada.',
  'status.month': 'A mostrar {month}.',
  'status.filter.one': 'A mostrar {n} despesa de «{category}».',
  'status.filter.other': 'A mostrar {n} despesas de «{category}».',
  'status.filterAll': 'A mostrar todas as categorias.',
  'status.catAdded': 'Categoria «{name}» adicionada.',
  'status.catRenamed': 'Categoria renomeada para «{name}».',
  'status.catDeleted': 'Categoria «{name}» eliminada.',
  'status.sample': 'Dados de exemplo carregados.',
  'status.reset': 'Todos os dados foram eliminados.',

  // 4.7 Confirmation dialogs
  'confirm.cancel': 'Cancelar',
  'confirm.irreversible': 'Esta ação não pode ser anulada.',
  'confirm.expense.title': 'Eliminar esta despesa?',
  'confirm.expense.ok': 'Eliminar',
  'confirm.category.title': 'Eliminar a categoria «{name}»?',
  'confirm.category.ok': 'Eliminar',
  'confirm.sample.title': 'Carregar dados de exemplo?',
  'confirm.sample.body': 'Os dados de exemplo são fictícios e substituem todas as despesas que tiver registado. As categorias mantêm-se.',
  'confirm.sample.ok': 'Carregar dados de exemplo',
  'confirm.reset.title': 'Eliminar todos os dados?',
  'confirm.reset.body': 'Todas as despesas e categorias criadas por si serão eliminadas deste navegador. Esta ação não pode ser anulada.',
  'confirm.reset.ok': 'Eliminar tudo',
});

/** Fill `{placeholders}`. Unknown keys throw, so a missing string fails fast in tests. */
export function format(key, params = {}) {
  const text = MESSAGES[key];
  if (text === undefined) throw new Error(`Unknown message key: ${key}`);
  return text.replace(/\{(\w+)\}/g, (m, name) => (name in params ? String(params[name]) : m));
}

/** Singular/plural pick (pt-PT: 1 is singular, 0 and >1 plural). */
export function plural(baseKey, n, params = {}) {
  return format(`${baseKey}.${n === 1 ? 'one' : 'other'}`, { n, ...params });
}

const PERCENT = new Intl.NumberFormat('pt-PT', {
  style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1,
});

/** 52.6 -> "52,6%". */
export function formatPercent(percent) {
  return PERCENT.format(percent / 100);
}
