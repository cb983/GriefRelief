sap.ui.define(['sap/fe/test/ObjectPage'], function(ObjectPage) {
    'use strict';

    var CustomPageDefinitions = {
        actions: {},
        assertions: {}
    };

    return new ObjectPage(
        {
            appId: 'griefrelief',
            componentId: 'GRIEF_RECORDObjectPage',
            contextPath: '/GRIEF_RECORD'
        },
        CustomPageDefinitions
    );
});