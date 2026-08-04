// src/utils/tourSteps.js
// Contenido de los tutoriales guiados, una función por vista.
//
// Las funciones se ejecutan al ABRIR el tutorial (no al importarlas), así que
// pueden leer el estado real de la vista. Dos formas de no explicar algo que no
// está en pantalla (ver resolveSteps() en useTutorial.js):
//   - `optional: true`  → el paso se descarta si su elemento no está visible.
//   - `when: () => bool` → el paso se descarta si la condición da false.
// Las descripciones se insertan como HTML, se permiten <strong>/<em>/<br>.

const REOPEN_HINT =
    '<br><br><em>Puedes volver a abrir esta guía cuando quieras con el botón <strong>?</strong> de la barra de arriba.</em>';

export function dashboardTour({ hasRecipes }) {
    return [
        {
            title: '¡Bienvenido!',
            description:
                'Esta es tu pantalla principal: el catálogo de todo lo que vendes. Cada receta guarda sus ingredientes, cuántas unidades salen de un lote y a qué precio te conviene venderla.' +
                '<br><br>Lo importante: los precios no se escriben a mano. Se recalculan solos cada vez que cambia el costo de un ingrediente en el inventario.' +
                REOPEN_HINT,
        },
        {
            element: '[data-tour="recipes-new"]',
            title: 'Crear una receta',
            description:
                'Acá empiezas. El formulario sólo te pide el nombre — los ingredientes, los costos y los márgenes se cargan después, dentro de la ficha de la receta.',
        },
        {
            element: '[data-tour="recipes-filters"]',
            optional: true,
            title: 'Filtros rápidos',
            description:
                '<strong>Margen alto</strong> son las recetas con 45% o más de ganancia.' +
                '<br><br><strong>Datos incompletos</strong> son las que todavía no pueden calcular un precio: no tienen ingredientes, o alguno de sus ingredientes fue borrado del inventario o le falta el tamaño de presentación. Esas recetas muestran un aviso en vez del precio.',
        },
        {
            element: '[data-tour="recipes-lowstock"]',
            optional: true,
            title: 'Aviso de inventario',
            description:
                'Aparece cuando algún ingrediente te queda al 60% o menos de una presentación completa. El punto rojo marca los que están al 25% o menos.',
        },
        {
            element: '[data-tour="recipes-card"]',
            optional: true,
            title: 'La tarjeta de una receta',
            description:
                'Te resume lo esencial: el <strong>PVP final por item</strong> (lo que deberías cobrar por unidad) y, debajo, lo que realmente te cuesta producir esa unidad.' +
                '<br><br>La barra de colores reparte ese precio entre ingredientes, mano de obra y ganancia. Con <strong>Ver receta</strong> entras a editar costos y márgenes; con <strong>Producir</strong> saltas directo a registrar un lote.',
        },
        {
            element: '[data-tour="recipes-empty"]',
            optional: true,
            title: 'Todavía no hay recetas',
            description:
                'Un consejo de orden: carga primero tus ingredientes en el <strong>Inventario</strong> (con lo que pagaste y el tamaño de la presentación) y después crea la receta. Así el precio te sale calculado desde el primer momento.',
        },
        {
            when: () => hasRecipes,
            title: 'Un detalle antes de irte',
            description:
                'Si cambias el precio de un ingrediente en el inventario, <strong>todas</strong> las recetas que lo usan se actualizan solas. No tienes que revisarlas una por una.',
        },
    ];
}

export function ingredientsTour({ hasIngredients, hasUnknownStock }) {
    return [
        {
            title: 'Tu inventario',
            description:
                'Acá vive el costo real de todo lo que compras. Las recetas toman sus precios de esta lista, así que mantener esto al día es lo que hace que los precios de venta tengan sentido.' +
                REOPEN_HINT,
        },
        {
            element: '[data-tour="ingredients-new"]',
            title: 'Cargar un ingrediente',
            description:
                'Se cargan tres datos y de ahí sale todo:' +
                '<br><br><strong>Costo de presentación:</strong> lo que pagaste por el paquete completo.' +
                '<br><strong>Tamaño de presentación:</strong> cuánto trae ese paquete (por ejemplo 1&nbsp;kg de harina = 1000 gr).' +
                '<br><strong>Stock actual:</strong> cuánto te queda hoy.' +
                '<br><br>Con los dos primeros la app saca el costo por gramo o por unidad, y eso es lo que cobra cada receta.',
        },
        {
            element: '[data-tour="ingredients-stats"]',
            optional: true,
            title: 'Nivel de stock',
            description:
                'El nivel se mide comparando lo que te queda contra <strong>una</strong> presentación completa, no contra un mínimo fijo:' +
                '<br><br><strong>Bajo:</strong> 25% o menos. <strong>Medio:</strong> entre 25% y 60%. <strong>Alto:</strong> más de 60%.',
        },
        {
            element: '[data-tour="ingredients-unknown"]',
            optional: true,
            title: 'Nivel desconocido',
            description:
                'Estos ingredientes no tienen tamaño de presentación cargado, así que no se puede calcular ni su nivel de stock ni su costo por unidad. Las recetas que los usen van a quedar marcadas como incompletas hasta que lo completes.',
            when: () => hasUnknownStock,
        },
        {
            element: '[data-tour="ingredients-table"]',
            optional: true,
            when: () => hasIngredients,
            title: 'La tabla',
            description:
                'Cada fila muestra el costo de la presentación, el costo por unidad ya calculado y una barra con el nivel de stock.' +
                '<br><br><strong>Ajustar stock</strong> es para cuando compras más o corriges un conteo. No hace falta usarlo al producir: registrar un lote descuenta el stock solo.' +
                '<br><br><em>En el celular cada fila se toca para desplegar el resto de los datos.</em>',
        },
        {
            element: '[data-tour="ingredients-table"]',
            optional: true,
            when: () => !hasIngredients,
            title: 'Empieza por acá',
            description:
                'Todavía no hay ingredientes cargados. Este es el primer paso de todo: sin ingredientes con su costo, las recetas no pueden calcular ningún precio.',
        },
    ];
}

export function productionTour({ hasRecipeSelected, hasRecords }) {
    return [
        {
            title: 'Registro de producción',
            description:
                'Cada vez que produces un lote lo registras acá. La app hace dos cosas por ti: descuenta del inventario los ingredientes que usaste y guarda cuánto costó y cuánto ganaste con ese lote.' +
                REOPEN_HINT,
        },
        {
            element: '[data-tour="production-recipe"]',
            optional: true,
            title: 'Qué produjiste',
            description:
                'Eliges la receta y listo — las cantidades salen de ella. Junto a cada nombre ves cuántos items rinde el lote y el precio de venta por item.',
        },
        {
            element: '[data-tour="production-date"]',
            optional: true,
            title: 'Fecha e items',
            description:
                '<strong>Items del lote</strong> no se edita acá: viene de la receta. Si un día horneas media tanda o el doble, lo correcto es ajustar la receta (o crear una variante), no forzar el número en este formulario.',
        },
        {
            element: '[data-tour="production-deductions"]',
            optional: true,
            title: 'Lo que se va a descontar',
            description:
                'Antes de guardar te muestra exactamente qué sale del inventario y con cuánto stock vas a quedar. Si un ingrediente no te alcanza, la cantidad aparece en rojo.',
        },
        {
            element: '[data-tour="production-estimate"]',
            optional: true,
            when: () => hasRecipeSelected,
            title: 'Ganancia estimada',
            description:
                'La cuenta del lote completo: el <strong>ingreso total</strong> es el PVP por la cantidad de items; los <strong>gastos operativos</strong> son ingredientes más empaque; y la <strong>mano de obra</strong> va aparte.' +
                '<br><br>El <strong>margen sobre ingreso</strong> es cuánto de cada dólar vendido te queda limpio. Ese número siempre es menor que el margen de ganancia que configuraste en la receta, y es normal — es la misma ganancia mirada desde el otro lado.',
        },
        {
            element: '[data-tour="production-estimate"]',
            optional: true,
            when: () => !hasRecipeSelected,
            title: 'Ganancia estimada',
            description:
                'Al elegir una receta arriba, acá aparece la cuenta del lote: ingreso total, gastos operativos, mano de obra y la ganancia que te queda. Sirve para decidir <em>antes</em> de ponerte a producir.',
        },
        {
            element: '[data-tour="production-submit"]',
            optional: true,
            title: 'Registrar el lote',
            description:
                'Al guardar se descuenta el stock automáticamente. Si después borras el registro, el stock se devuelve — todo eso queda anotado en el Historial.',
        },
        {
            element: '[data-tour="production-table"]',
            optional: true,
            when: () => hasRecords,
            title: 'Historial de lotes',
            description:
                'Todo lo que has producido, con su ganancia neta y si ya lo vendiste o no. Los totales del pie suman <strong>todos</strong> los registros que coincidan con la búsqueda, no sólo los de la página que estás viendo.',
        },
    ];
}

export function accountingTour({ hasTransactions }) {
    return [
        {
            title: 'Contabilidad',
            description:
                'Acá llevas el dinero que entra y sale del negocio, en <strong>Bs., dólares, euros o USDT</strong>. Es independiente de la producción: puedes registrar la compra de un horno, el pago del local o una venta suelta.' +
                REOPEN_HINT,
        },
        {
            element: '[data-tour="accounting-currency"]',
            optional: true,
            title: 'Multimoneda',
            description:
                'Puedes registrar movimientos en <strong>Bs., USD, EUR o USDT</strong>, mezclados como sea. Cada uno guarda el monto tal como lo escribiste.' +
                '<br><br>Para poder sumarlos entre sí, por debajo todos se convierten a una misma unidad (dólares a tasa BCV). Este selector decide en qué moneda quieres <em>leer</em> los totales — no cambia nada de lo guardado.',
        },
        {
            element: '[data-tour="accounting-summary"]',
            optional: true,
            title: 'Ingresos, egresos y saldo',
            description:
                'El resumen del periodo que tengas filtrado abajo, en la moneda que elegiste arriba.',
        },
        {
            element: '[data-tour="accounting-rate"]',
            optional: true,
            title: 'Las tasas del día',
            description:
                'Se buscan solas al abrir esta pantalla. La de <strong>USDT</strong> no viene dada por la fuente: se calcula como el promedio entre el precio de compra y el de venta de Binance.' +
                '<br><br>La del <strong>BCV (Bs/USD)</strong> es la más importante: es la base con la que se comparan todas las demás monedas. Sin ella no se puede convertir nada.' +
                '<br><br>Con <strong>Manual</strong> las cargas a mano; las que dejes en blanco no se tocan.' +
                '<br><br><strong>Ojo con las fechas pasadas:</strong> la fuente sólo entrega las tasas de hoy. Si registras un movimiento con una fecha vieja para la que nunca se guardaron tasas, se van a usar las de hoy. Para esos casos conviene cargarlas a mano.',
        },
        {
            element: '[data-tour="accounting-filters"]',
            optional: true,
            title: 'Periodo y tipo',
            description:
                'Todo lo que ves arriba y abajo responde a este filtro. Por defecto muestra los últimos 30 días.',
        },
        {
            element: '[data-tour="accounting-new"]',
            optional: true,
            title: 'Registrar un movimiento',
            description:
                'Cargas el <strong>monto</strong> y eliges su <strong>moneda</strong>, si es ingreso o egreso, la categoría y la fecha. Debajo del monto siempre ves a cuánto equivale y con qué tasa se calculó.' +
                '<br><br>Si eliges EUR o USDT en una fecha para la que no hay tasa guardada, el formulario te la pide antes de dejarte guardar — prefiere pedírtela a inventar una conversión.',
        },
        {
            element: '[data-tour="accounting-table"]',
            optional: true,
            when: () => hasTransactions,
            title: 'Los movimientos',
            description:
                'Cada línea muestra el monto <strong>en la moneda en que lo cargaste</strong>, la tasa que se usó en ese momento y su equivalente en dólares.' +
                '<br><br>Esa tasa queda congelada a propósito: un movimiento viejo no cambia de valor aunque la tasa de hoy sea otra.',
        },
    ];
}

export function historyTour({ hasEntries }) {
    return [
        {
            title: 'Historial de cambios',
            description:
                'Un registro de todo lo que pasó en tu cuenta: recetas creadas o editadas, ingredientes borrados, stock ajustado, movimientos de contabilidad. Sirve para responder "¿y esto quién lo cambió, y cuándo?".' +
                REOPEN_HINT,
        },
        {
            element: '[data-tour="history-filters"]',
            title: 'Filtrar por fecha',
            description:
                'Acota el historial a hoy, a esta semana, a este mes o a los últimos tres meses. Se combina con el buscador de arriba.',
        },
        {
            element: '[data-tour="history-list"]',
            optional: true,
            title: 'Cada evento',
            description:
                'La hora, una etiqueta con el tipo de cambio y un resumen de lo que se modificó. Con <strong>Ver detalle</strong> abres la comparación completa: valor anterior → valor nuevo, campo por campo.',
        },
        {
            element: '[data-tour="history-loadmore"]',
            optional: true,
            title: 'Cargar más',
            description:
                'Los eventos se traen de a 100. Ten en cuenta que el buscador y los filtros trabajan sobre lo que ya está cargado: si buscas algo viejo, carga más eventos primero.',
        },
    ];
}

/**
 * Tutorial de la ficha de receta — el que explica de dónde sale el precio.
 * @param {{ setTab: (tab: 'ingredients'|'costs') => void }} ctx
 */
export function recipeDrawerTour({ setTab }) {
    return [
        {
            title: 'De dónde sale el precio',
            description:
                'Esta ficha tiene dos pestañas: los <strong>ingredientes</strong> que lleva un lote y los <strong>costos y márgenes</strong> que convierten ese costo en un precio de venta.' +
                '<br><br>Vamos a recorrer las dos, que es donde está el corazón del negocio.',
        },
        {
            element: '[data-tour="drawer-ing-form"]',
            title: 'Ingredientes del lote',
            description:
                'La cantidad que cargues acá es la que consume <strong>un lote completo</strong>, no una unidad.' +
                '<br><br>Si tu receta rinde 24 galletas y lleva medio kilo de harina, acá van 500 gr. La app se encarga después de dividir entre las 24.',
        },
        {
            element: '[data-tour="drawer-ing-total"]',
            title: 'Costo de ingredientes',
            description:
                'La suma de todos los ingredientes del lote, calculada con el precio por gramo/unidad que sale de tu inventario. Si mañana sube la harina, este número sube solo.',
        },
        {
            element: '[data-tour="drawer-tab-costs"]',
            title: 'Ahora, los costos',
            description:
                'Los ingredientes son sólo una parte del costo. Pasemos a la otra pestaña, que es donde se define cuánto vas a cobrar.',
            onNext: () => setTab('costs'),
        },
        {
            element: '[data-tour="drawer-packaging"]',
            title: 'Empaque',
            description:
                'Lo que gastas en cajas, bolsas, cintas, etiquetas o bandejas para <strong>todo el lote</strong>. Es un costo real que casi siempre se olvida y se come la ganancia sin que te des cuenta.',
            onPrev: () => setTab('ingredients'),
        },
        {
            element: '[data-tour="drawer-labor"]',
            title: 'Mano de obra: tu tiempo vale',
            description:
                'Cuánto cuesta el <strong>trabajo</strong> de hacer un lote completo — el tuyo o el de quien produzca.' +
                '<br><br>Este es el error más común al poner precios: si lo dejas en cero, el número te va a parecer rentable, pero en realidad estarías regalando tus horas y sólo recuperando materiales.' +
                '<br><br><strong>Una forma sencilla de calcularlo:</strong> decide cuánto quieres ganar por hora y multiplícalo por las horas que te lleva el lote de punta a punta (preparar, hornear, decorar, limpiar). Si te toma 3 horas y valoras tu hora en $5, acá van $15.',
        },
        {
            element: '[data-tour="drawer-items"]',
            title: 'Items por lote',
            description:
                'Cuántas unidades vendibles salen de un lote. Es el número que divide todo lo demás: ingredientes, empaque y mano de obra se reparten entre estos items para llegar al costo de <strong>una</strong> unidad.' +
                '<br><br>Por eso, producir lotes más grandes casi siempre baja el costo por unidad.',
        },
        {
            element: '[data-tour="drawer-margin"]',
            title: 'Margen de ganancia',
            description:
                'Tu ganancia, como porcentaje <strong>sobre el costo</strong>.' +
                '<br><br>Ejemplo: si producir una unidad te cuesta $1,00 y pones 40%, el precio pasa a $1,40 y te quedan $0,40 limpios por unidad.' +
                '<br><br><em>Un detalle que confunde a todo el mundo:</em> ese 40% sobre el costo equivale a un 28,6% sobre la venta ($0,40 de $1,40). No es que estés ganando menos de lo que crees — son dos formas de medir la misma ganancia. Si alguien te habla de "margen del 40% sobre la venta", ahí tendrías que cargar cerca de 67% acá.',
        },
        {
            element: '[data-tour="drawer-buffer"]',
            title: 'Buffer de pérdida',
            description:
                'Un porcentaje extra para cubrir lo que se pierde: lo que se quema, se rompe al transportarlo, se prueba o simplemente no se vende.' +
                '<br><br>Se aplica <strong>después</strong> de la ganancia, sobre el precio ya con margen. Si no lo usas déjalo en 0; un 5% a 10% es un punto de partida razonable para repostería.',
        },
        {
            element: '[data-tour="drawer-breakdown"]',
            title: 'La cuenta completa',
            description:
                'Acá ves toda la fórmula armada, por unidad y en orden: ingredientes, más empaque, más mano de obra dan tu <strong>costo unitario</strong>; encima va la ganancia y encima el buffer.' +
                '<br><br>El número grande de abajo es el <strong>PVP final</strong>: lo que deberías cobrar por unidad. Si te parece muy alto o muy bajo, ahora sabes exactamente qué mover.',
        },
        {
            element: '[data-tour="drawer-save"]',
            title: 'Guardar',
            description:
                'Los cálculos que ves se guardan junto a la receta, y son los que va a usar el registro de producción. Por eso, si creaste la receta hace rato y nunca la guardaste desde acá, conviene darle a <strong>Guardar cambios</strong> una vez.',
        },
    ];
}
