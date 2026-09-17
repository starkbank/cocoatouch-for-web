

const DATE_FORMATS = {
    "en": {picker: "mm/dd/yy", moment: "MM/DD/YYYY"},
    "en-US": {picker: "mm/dd/yy", moment: "MM/DD/YYYY"},
    "pt-BR": {picker: "dd/mm/yy", moment: "DD/MM/YYYY"}
}

const REGIONAL = {
    "pt-BR": {
        closeText: "Fechar",
        prevText: "Anterior",
        nextText: "Próximo",
        currentText: "Hoje",
        monthNames: ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"],
        monthNamesShort: ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"],
        dayNames: ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"],
        dayNamesShort: ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"],
        dayNamesMin: ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"],
        weekHeader: "Sm",
        dateFormat: "dd/mm/yy",
        firstDay: 0,
        isRTL: false,
        showMonthAfterYear: false,
        yearSuffix: ""
    },
    "en-US": {
        monthNames: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
        monthNamesShort: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
        dayNames: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
        dayNamesShort: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
        dayNamesMin: ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]
    }
}


export class Locale {

    constructor(identifier) {
        this.identifier = identifier
    }

    get languageCode() {
        return this.identifier.split("-")[0]
    }

    get regionCode() {
        return this.identifier.split("-")[1] || null
    }

    // jQuery UI datepicker format for this locale
    get dateFormat() {
        return (DATE_FORMATS[this.identifier] || DATE_FORMATS["en"]).picker
    }

    get momentDateFormat() {
        return (DATE_FORMATS[this.identifier] || DATE_FORMATS["en"]).moment
    }

    // jQuery UI datepicker regional strings for this locale
    get regional() {
        return REGIONAL[this.identifier]
    }
}
