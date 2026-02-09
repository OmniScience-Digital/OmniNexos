
export interface vifForm {
  id: string;
  vehicleReg: string;
  vehicleVin:string;
  lastServicedate:Date;
  lastServicekm:Number;
  lastRotationkm:Number;
  fleetNumber:string,
  servicePlanStatus: Boolean,
  servicePlan:string,
  lastRotationdate:Date,
      

}

export interface Fleet {
    id: string;
    vehicleVin: string | null;
    vehicleReg: string | null;
    vehicleMake: string | null;
    vehicleModel: string | null;
    transmitionType: string | null;
    ownershipStatus: string | null;
    fleetIndex: string | null;
    fleetNumber: string | null;
    lastServicedate: string | null;
    lastServicekm: number | null;
    lastRotationdate: string | null;
    lastRotationkm: number | null;
    servicePlanStatus: boolean;
    servicePlan: string | null;
    currentDriver: string | null;
    currentkm: number | null;
    codeRequirement: string | null;
    pdpRequirement: boolean;
    breakandLuxTest: string|null;
    serviceplankm: number | null;
    breakandLuxExpirey: string | null;
    liscenseDiscExpirey:string | null;
}

export interface PrintMenuProps {
    isOpen: boolean;
    onClose: () => void;
    onDownloadCSV: () => void;
    onDownloadPDF: () => void;
    position: { top: number; left: number };
}


export interface Inspection {
    id: string;
    fleetid: string;
    inspectionNo: number | null;
    vehicleVin: string | null;
    inspectionDate: string | null;
    inspectionTime: string | null;
    odometerStart: number | null;
    vehicleReg: string | null;
    inspectorOrDriver: string | null;
    oilAndCoolant: boolean | null;
    fuelLevel: boolean | null;
    seatbeltDoorsMirrors: boolean | null;
    handbrake: boolean | null;
    tyreCondition: boolean | null;
    spareTyre: boolean | null;
    numberPlate: boolean | null;
    licenseDisc: boolean | null;
    leaks: boolean | null;
    lights: boolean | null;
    defrosterAircon: boolean | null;
    emergencyKit: boolean | null;
    clean: boolean | null;
    warnings: boolean | null;
    windscreenWipers: boolean | null;
    serviceBook: boolean | null;
    siteKit: boolean | null;
    photo: string[] | [];
    history: string | null;
}