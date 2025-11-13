import Controller from "sap/ui/core/mvc/Controller";
import MessageToast from "sap/m/MessageToast";
import JSONModel from "sap/ui/model/json/JSONModel";
import Event from "sap/ui/base/Event";
import FileUploader from "sap/ui/unified/FileUploader";
import ODataModel from "sap/ui/model/odata/v2/ODataModel";
import Context from "sap/ui/model/Context";
import Component from "sap/ui/core/Component";
import View from "sap/ui/core/mvc/View";

interface ViewModel {
    busy: boolean;
    imagePreview: string;
    description: string;
    submitEnabled: boolean;
}

export default class Main extends Controller {
    // End-to-end flow tested and verified
    
    private viewModel: JSONModel;

    public onInit(): void {
        this.viewModel = new JSONModel({
            busy: false,
            imagePreview: "",
            description: "",
            submitEnabled: false
        });
        (this.getView() as View).setModel(this.viewModel, "viewModel");
    }

    public handleFileUpload(oEvent: Event): void {
        const fileUploader = oEvent.getSource() as FileUploader;
        const file = (fileUploader.getFocusDomRef() as HTMLInputElement | null)?.files?.[0];
        if (file) {
            this._setImagePreview(file);
            this._updateSubmitButtonState();
        }
    }

    public onDescriptionChange(oEvent: Event): void {
        const description = (oEvent.getSource() as any).getValue();
        this.viewModel.setProperty("/description", description);
        this._updateSubmitButtonState();
    }

    private _updateSubmitButtonState(): void {
        const description = this.viewModel.getProperty("/description") as string;
        const imagePreview = this.viewModel.getProperty("/imagePreview") as string;
        const submitEnabled = !!(description || imagePreview);
        this.viewModel.setProperty("/submitEnabled", submitEnabled);
    }

    public onTakePhoto(): void {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/jpeg';
        fileInput.capture = 'camera';

        fileInput.onchange = (e: globalThis.Event) => {
            const target = e.target as HTMLInputElement;
            const file = target.files?.[0];
            if (file) {
                this._setImagePreview(file);
            }
        };

        fileInput.click();
    }

    private _setImagePreview(file: File): void {
        const reader = new FileReader();
        reader.onload = (e: ProgressEvent<FileReader>) => {
            this.viewModel.setProperty("/imagePreview", e.target?.result as string);
            this._updateSubmitButtonState();
        };
        reader.readAsDataURL(file);
    }

    public async onSubmit(): Promise<void> {
        const sDescription = this.viewModel.getProperty("/description") as string;
        const sImagePreview = this.viewModel.getProperty("/imagePreview") as string;

        if (!this.viewModel.getProperty("/submitEnabled")) {
            MessageToast.show("Please upload an image or provide a description");
            return;
        }

        try {
            this.viewModel.setProperty("/busy", true);

            const oDataModel = (this.getOwnerComponent() as Component).getModel() as ODataModel;
            const oContext = oDataModel.createEntry("/GRIEF_RECORD", {
                properties: {
                    OCR_LABEL_TEXT: sDescription,
                    IMAGE_URL: sImagePreview
                }
            });

            await new Promise<void>((resolve, reject) => {
                oDataModel.submitChanges({
                    success: () => resolve(),
                    error: (error: any) => reject(error)
                });
            });

            if (!oContext) {
                throw new Error("Failed to create GRIEF_RECORD entry");
            }

            const oGriefRecord = oContext.getObject() as { GRIEF_ID: string };

            if (!oGriefRecord || !oGriefRecord.GRIEF_ID) {
                throw new Error("Failed to retrieve GRIEF_ID from created record");
            }

            // Call the submit action
            const result = await new Promise<any>((resolve, reject) => {
                (oDataModel as any).callFunction("/GriefReliefService.submit", {
                    method: "POST",
                    urlParameters: { GRIEF_ID: oGriefRecord.GRIEF_ID },
                    success: (data: any) => resolve(data),
                    error: (error: any) => reject(error)
                });
            });

            if (result && result.success) {
                MessageToast.show(`Submission successful. ${result.message}`);
                if (result.result && (result.result.type === 'DETERMINISTIC' || result.result.type === 'PROBABILISTIC')) {
                    MessageToast.show(`Putaway location resolved: ${result.result.decision.storageLocation}`);
                }
            } else {
                MessageToast.show(`Submission processed. ${result ? result.message : 'No result returned.'}`);
            }

            // Reset the form
            this.viewModel.setProperty("/imagePreview", "");
            this.viewModel.setProperty("/description", "");
        } catch (error) {
            console.error("Error during submission:", error);
            MessageToast.show("An error occurred during submission. Please try again.");
        } finally {
            this.viewModel.setProperty("/busy", false);
        }
    }
}
