// src/utils/multiselectTheme.js
// Tema compartido de @vueform/multiselect — usado por RegisterView y RecipeDrawer.
// Antes duplicado en ambos componentes sobrescribiendo sólo 12 de ~25 claves;
// aquí se completa con clear/caret/spinner/optionsList/singleLabel.
export const multiselectTheme = {
    container: 'relative mx-auto w-full flex items-center justify-end box-border cursor-pointer border border-stone-200 rounded-field bg-white text-sm leading-snug outline-none min-h-[46px] dark:border-stone-700 dark:bg-stone-800',
    containerActive: 'ring-2 ring-accent-600/35 border-accent-600 dark:border-accent-500',
    singleLabel: 'flex items-center h-full max-w-full absolute left-0 top-0 pointer-events-none bg-transparent leading-snug pl-3.5 rtl:pl-0 rtl:pr-3.5',
    singleLabelText: 'overflow-ellipsis overflow-hidden block whitespace-nowrap max-w-full text-stone-800 dark:text-stone-100',
    placeholder: 'flex items-center h-full absolute left-0 top-0 pointer-events-none bg-transparent leading-snug pl-3.5 text-stone-400',
    caret: 'bg-stone-400 dark:bg-stone-500 mr-3',
    clear: 'pr-3.5 cursor-pointer',
    spinner: 'bg-accent-600 dark:bg-accent-500 mr-3',
    dropdown: 'absolute -left-px -right-px bottom-0 transform translate-y-full border border-stone-200 -mt-px overflow-y-auto z-50 bg-white flex flex-col rounded-b-field dark:border-stone-700 dark:bg-stone-800',
    dropdownHidden: 'hidden',
    optionsList: 'p-1',
    option: 'flex items-center justify-start box-border text-left cursor-pointer text-sm leading-snug py-2 px-3 rounded-control text-stone-800 dark:text-stone-100',
    optionPointed: 'bg-stone-100 dark:bg-stone-700',
    optionSelected: 'bg-accent-50 text-accent-700 dark:bg-accent-500/15 dark:text-accent-300',
    optionDisabled: 'text-stone-300 cursor-not-allowed dark:text-stone-600',
    noOptions: 'py-2 px-3 text-stone-400 text-left text-sm',
    noResults: 'py-2 px-3 text-stone-400 text-left text-sm',
    search: 'w-full absolute inset-0 outline-none focus:ring-0 appearance-none box-border border-0 text-sm bg-white dark:bg-stone-800 rounded-field pl-3.5 rtl:pl-0 rtl:pr-3.5 text-stone-800 dark:text-stone-100',
};
