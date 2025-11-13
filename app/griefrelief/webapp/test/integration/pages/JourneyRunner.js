sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"griefrelief/test/integration/pages/GRIEF_RECORDList",
	"griefrelief/test/integration/pages/GRIEF_RECORDObjectPage"
], function (JourneyRunner, GRIEF_RECORDList, GRIEF_RECORDObjectPage) {
    'use strict';

    var runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('griefrelief') + '/test/flp.html#app-preview',
        pages: {
			onTheGRIEF_RECORDList: GRIEF_RECORDList,
			onTheGRIEF_RECORDObjectPage: GRIEF_RECORDObjectPage
        },
        async: true
    });

    return runner;
});

