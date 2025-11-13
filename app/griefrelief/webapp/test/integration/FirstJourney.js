sap.ui.define([
    "sap/ui/test/opaQunit",
    "./pages/JourneyRunner"
], function (opaTest, runner) {
    "use strict";

    function journey() {
        QUnit.module("First journey");

        opaTest("Start application", function (Given, When, Then) {
            Given.iStartMyApp();

            Then.onTheGRIEF_RECORDList.iSeeThisPage();

        });


        opaTest("Navigate to ObjectPage", function (Given, When, Then) {
            // Note: this test will fail if the ListReport page doesn't show any data
            
            When.onTheGRIEF_RECORDList.onFilterBar().iExecuteSearch();
            
            Then.onTheGRIEF_RECORDList.onTable().iCheckRows();

            When.onTheGRIEF_RECORDList.onTable().iPressRow(0);
            Then.onTheGRIEF_RECORDObjectPage.iSeeThisPage();

        });

        opaTest("Teardown", function (Given, When, Then) { 
            // Cleanup
            Given.iTearDownMyApp();
        });
    }

    runner.run([journey]);
});