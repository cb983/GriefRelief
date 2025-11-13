sap.ui.define(['sap/fe/test/ListReport'], function(ListReport) {
    'use strict';

    var CustomPageDefinitions = {
        actions: {},
        assertions: {}
    };

    return new ListReport(
        {
            appId: 'griefrelief',
            componentId: 'GRIEF_RECORDList',
            contextPath: '/GRIEF_RECORD'
        },
        CustomPageDefinitions
    );
});