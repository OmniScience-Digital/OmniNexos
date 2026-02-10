import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Footer from "@/components/layout/footer";
import Navbar from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import ResponseModal from "@/components/widgets/response";
import { client } from "@/services/schema";
import type { CustomerSiteState } from "@/types/crm.types";
import { ArrowLeft, Building, MapPin, User, Mail, Loader2 } from "lucide-react";



export default function CreateCustomer() {
    const navigate = useNavigate();
    const [saving, setSaving] = useState(false);
    const [show, setShow] = useState(false);
    const [successful, setSuccessful] = useState(false);
    const [message, setMessage] = useState("");

    const [formData, setFormData] = useState<CustomerSiteState>({
        // Site Information
        siteName: '',
        siteLocation: '',
        siteDistance: '',
        siteTolls: '',

        // Customer Company Information
        customerName: '',
        registrationNo: '',
        vatNo: '',
        vendorNumber: '',
        postalAddress: '',
        physicalAddress: '',

        // Contact Information
        siteContactName: '',
        siteContactMail: '',
        siteContactNumber: '',

        siteManagerName: '',
        siteManagerMail: '',
        siteManagerNumber: '',

        siteSafetyName: '',
        siteSafetyMail: '',
        siteSafetyNumber: '',

        siteProcurementName: '',
        siteProcurementMail: '',
        siteProcurementNumber: '',

        siteCreditorsName: '',
        siteCreditorsMail: '',
        siteCreditorsNumber: '',

        comment: '',
    });

    const handleInputChange = (field: keyof CustomerSiteState, value: string) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
    };
    // Add validation function
    const validateForm = (): boolean => {
        if (!formData.siteName?.trim()) {
            setMessage("Site Name is required!");
            setShow(true);
            setSuccessful(false);
            return false;
        }
        if (!formData.customerName?.trim()) {
            setMessage("Customer Name is required!");
            setShow(true);
            setSuccessful(false);
            return false;
        }
        return true;
    };

    const handleSubmit = async () => {
        try {
            if (!validateForm()) {
                return;
            }

            setSaving(true);

            const storedName = localStorage.getItem("user")?.replace(/^"|"$/g, '').trim() || "Unknown User";
            const johannesburgTime = new Date().toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" });
            const historyEntries = `${storedName} created new customer site at ${johannesburgTime}.\n`;

            // Prepare customer site data
            const customerSiteData = {
                siteName: formData.siteName,
                siteLocation: formData.siteLocation || null,
                siteDistance: formData.siteDistance ? parseFloat(formData.siteDistance) : null,
                siteTolls: formData.siteTolls ? parseFloat(formData.siteTolls) : null,
                customerName: formData.customerName,
                registrationNo: formData.registrationNo || null,
                vatNo: formData.vatNo || null,
                vendorNumber: formData.vendorNumber || null,
                postalAddress: formData.postalAddress || null,
                physicalAddress: formData.physicalAddress || null,
                siteContactName: formData.siteContactName || null,
                siteContactMail: formData.siteContactMail || null,
                siteContactNumber: formData.siteContactNumber || null,
                siteManagerName: formData.siteManagerName || null,
                siteManagerMail: formData.siteManagerMail || null,
                siteManagerNumber: formData.siteManagerNumber || null,
                siteSafetyName: formData.siteSafetyName || null,
                siteSafetyMail: formData.siteSafetyMail || null,
                siteSafetyNumber: formData.siteSafetyMail || null,
                siteProcurementName: formData.siteProcurementName || null,
                siteProcurementMail: formData.siteProcurementMail || null,
                siteProcurementNumber: formData.siteProcurementNumber || null,
                siteCreditorsName: formData.siteCreditorsName || null,
                siteCreditorsMail: formData.siteCreditorsMail || null,
                siteCreditorsNumber: formData.siteCreditorsNumber || null,
                comment: formData.comment || null,
            };

            const newCustomerSite = await client.models.CustomerSite.create(customerSiteData);

            if (!newCustomerSite.errors && newCustomerSite.data?.id) {

                // Add History table entry
                await client.models.History.create({
                    entityType: "CUSTOMER",
                    entityId: newCustomerSite.data?.id,
                    action: "CREATE",
                    timestamp: new Date().toISOString(),
                    details: historyEntries
                });
                navigate('/customerrelationsmanagement');
            } else {
                setMessage("Failed to create customer site!");
                setShow(true);
                setSuccessful(false);
            }

        } catch (error: any) {
            console.error("Error saving customer site:", error);
            const errorMessage = error.message || "Error creating customer site. Please check the console for details.";
            setMessage(errorMessage);
            setShow(true);
            setSuccessful(false);
        } finally {
            setSaving(false);
        }
    };
    return (
        <div className="flex flex-col min-h-screen bg-background from-slate-50 to-blue-50/30">
            <Navbar />
            <main className="flex-1 px-4 sm:px-6 mt-20 pb-20">
                <div className="container mx-auto max-w-6xl mt-8">
                    {/* Header */}
                    <div className="mb-8">
                        <div className="flex items-center gap-4 mb-6">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => navigate('/customerrelationsmanagement')}
                                className="h-9 w-9 p-0"
                            >
                                <ArrowLeft className="h-5 w-5" />
                            </Button>
                            <div>
                                <h2 className="text-2xl font-bold">
                                    Add New Customer Site
                                </h2>
                                <p className="text-muted-foreground mt-1 text-base">
                                    Create a new customer site profile
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-1 gap-8">
                        {/* Site Information */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <MapPin className="h-5 w-5" />
                                    Site Information
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <Label>Site Name *</Label>
                                        <Input
                                            value={formData.siteName}
                                            onChange={(e) => handleInputChange('siteName', e.target.value)}
                                            placeholder="Main Office"
                                        />
                                    </div>
                                    <div>
                                        <Label>Site Location</Label>
                                        <Input
                                            value={formData.siteLocation}
                                            onChange={(e) => handleInputChange('siteLocation', e.target.value)}
                                            placeholder="123 Main Street, City"
                                        />
                                    </div>
                                    <div>
                                        <Label>Site Distance (km)</Label>
                                        <Input
                                            type="number"
                                            value={formData.siteDistance}
                                            onChange={(e) => handleInputChange('siteDistance', e.target.value)}
                                            placeholder="50"
                                        />
                                    </div>
                                    <div>
                                        <Label>Site Tolls (ZAR)</Label>
                                        <Input
                                            type="number"
                                            value={formData.siteTolls}
                                            onChange={(e) => handleInputChange('siteTolls', e.target.value)}
                                            placeholder="120"
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Customer Company Information */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Building className="h-5 w-5" />
                                    Company Information
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <Label>Customer Name *</Label>
                                        <Input
                                            value={formData.customerName}
                                            onChange={(e) => handleInputChange('customerName', e.target.value)}
                                            placeholder="ABC Corporation"
                                        />
                                    </div>
                                    <div>
                                        <Label>Registration No</Label>
                                        <Input
                                            value={formData.registrationNo}
                                            onChange={(e) => handleInputChange('registrationNo', e.target.value)}
                                            placeholder="2023/123456/07"
                                        />
                                    </div>
                                    <div>
                                        <Label>VAT No</Label>
                                        <Input
                                            value={formData.vatNo}
                                            onChange={(e) => handleInputChange('vatNo', e.target.value)}
                                            placeholder="4870117894"
                                        />
                                    </div>
                                    <div>
                                        <Label>Vendor Number</Label>
                                        <Input
                                            value={formData.vendorNumber}
                                            onChange={(e) => handleInputChange('vendorNumber', e.target.value)}
                                            placeholder="VND-001"
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <Label>Postal Address</Label>
                                        <Input
                                            value={formData.postalAddress}
                                            onChange={(e) => handleInputChange('postalAddress', e.target.value)}
                                            placeholder="PO Box 123, City, Postal Code"
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <Label>Physical Address</Label>
                                        <Input
                                            value={formData.physicalAddress}
                                            onChange={(e) => handleInputChange('physicalAddress', e.target.value)}
                                            placeholder="123 Business Park, Industrial Area"
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Contact Information */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <User className="h-5 w-5" />
                                    Contact Information
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-6">
                                <div className="space-y-8">
                                    {/* Site Contact */}
                                    <div className="space-y-4">
                                        <h4 className="font-semibold border-b pb-2">Site Contact</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div>
                                                <Label>Name</Label>
                                                <Input
                                                    value={formData.siteContactName}
                                                    onChange={(e) => handleInputChange('siteContactName', e.target.value)}
                                                    placeholder="John Smith"
                                                />
                                            </div>
                                            <div>
                                                <Label>Email</Label>
                                                <Input
                                                    type="email"
                                                    value={formData.siteContactMail}
                                                    onChange={(e) => handleInputChange('siteContactMail', e.target.value)}
                                                    placeholder="john@company.com"
                                                />
                                            </div>
                                            <div>
                                                <Label>Phone</Label>
                                                <Input
                                                    value={formData.siteContactNumber}
                                                    onChange={(e) => handleInputChange('siteContactNumber', e.target.value)}
                                                    placeholder="+27 11 123 4567"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Site Manager */}
                                    <div className="space-y-4">
                                        <h4 className="font-semibold border-b pb-2">Site Manager</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div>
                                                <Label>Name</Label>
                                                <Input
                                                    value={formData.siteManagerName}
                                                    onChange={(e) => handleInputChange('siteManagerName', e.target.value)}
                                                    placeholder="Sarah Johnson"
                                                />
                                            </div>
                                            <div>
                                                <Label>Email</Label>
                                                <Input
                                                    type="email"
                                                    value={formData.siteManagerMail}
                                                    onChange={(e) => handleInputChange('siteManagerMail', e.target.value)}
                                                    placeholder="sarah@company.com"
                                                />
                                            </div>
                                            <div>
                                                <Label>Phone</Label>
                                                <Input
                                                    value={formData.siteManagerNumber}
                                                    onChange={(e) => handleInputChange('siteManagerNumber', e.target.value)}
                                                    placeholder="+27 11 123 4568"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    {/* Site Safety */}
                                    <div className="space-y-4">
                                        <h4 className="font-semibold border-b pb-2">Site Safety Name</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div>
                                                <Label>Name</Label>
                                                <Input
                                                    value={formData.siteSafetyName}
                                                    onChange={(e) => handleInputChange('siteSafetyName', e.target.value)}
                                                    placeholder="Sarah Johnson"
                                                />
                                            </div>
                                            <div>
                                                <Label>Email</Label>
                                                <Input
                                                    type="email"
                                                    value={formData.siteSafetyMail}
                                                    onChange={(e) => handleInputChange('siteSafetyMail', e.target.value)}
                                                    placeholder="sarah@company.com"
                                                />
                                            </div>
                                            <div>
                                                <Label>Phone</Label>
                                                <Input
                                                    value={formData.siteSafetyNumber}
                                                    onChange={(e) => handleInputChange('siteSafetyNumber', e.target.value)}
                                                    placeholder="+27 11 123 4568"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Site Procurement */}
                                    <div className="space-y-4">
                                        <h4 className="font-semibold border-b pb-2">Procurement</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div>
                                                <Label>Name</Label>
                                                <Input
                                                    value={formData.siteProcurementName}
                                                    onChange={(e) => handleInputChange('siteProcurementName', e.target.value)}
                                                    placeholder="Mike Wilson"
                                                />
                                            </div>
                                            <div>
                                                <Label>Email</Label>
                                                <Input
                                                    type="email"
                                                    value={formData.siteProcurementMail}
                                                    onChange={(e) => handleInputChange('siteProcurementMail', e.target.value)}
                                                    placeholder="mike@company.com"
                                                />
                                            </div>
                                            <div>
                                                <Label>Phone</Label>
                                                <Input
                                                    value={formData.siteProcurementNumber}
                                                    onChange={(e) => handleInputChange('siteProcurementNumber', e.target.value)}
                                                    placeholder="+27 11 123 4569"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Site Creditors */}
                                    <div className="space-y-4">
                                        <h4 className="font-semibold border-b pb-2">Creditors</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div>
                                                <Label>Name</Label>
                                                <Input
                                                    value={formData.siteCreditorsName}
                                                    onChange={(e) => handleInputChange('siteCreditorsName', e.target.value)}
                                                    placeholder="Lisa Brown"
                                                />
                                            </div>
                                            <div>
                                                <Label>Email</Label>
                                                <Input
                                                    type="email"
                                                    value={formData.siteCreditorsMail}
                                                    onChange={(e) => handleInputChange('siteCreditorsMail', e.target.value)}
                                                    placeholder="lisa@company.com"
                                                />
                                            </div>
                                            <div>
                                                <Label>Phone</Label>
                                                <Input
                                                    value={formData.siteCreditorsNumber}
                                                    onChange={(e) => handleInputChange('siteCreditorsNumber', e.target.value)}
                                                    placeholder="+27 11 123 4570"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Comments */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Mail className="h-5 w-5" />
                                    Additional Information
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-6">
                                <div>
                                    <Label>Comments</Label>
                                    <Textarea
                                        value={formData.comment}
                                        onChange={(e) => handleInputChange('comment', e.target.value)}
                                        placeholder="Any additional notes or comments..."
                                        className="min-h-[100px] text-sm resize-vertical"

                                    />
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex justify-end gap-4 mt-8">
                        <Button
                            variant="outline"
                            onClick={() => navigate('/customerrelationsmanagement')}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSubmit}
                            disabled={saving || !formData.siteName || !formData.customerName}
                        >
                            {saving ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Creating...
                                </>
                            ) : (
                                "Create Customer Site"
                            )}
                        </Button>
                        {show && (
                            <ResponseModal
                                successful={successful}
                                message={message}
                                setShow={setShow}
                            />
                        )}
                    </div>
                </div>
            </main>
            <Footer />
        </div>
    );
}