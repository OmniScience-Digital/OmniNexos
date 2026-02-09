import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { client } from "@/services/schema";
import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import Loading from "@/app/stockcontrolform/Components/component_loading";

interface TabsHistoryProps {
    customerSiteId: string;
}

export default function TabsHistory({ customerSiteId }: TabsHistoryProps) {
    //history
    const [history, setHistory] = useState("");
    const [loading, setLoading] = useState(true);

    // Fetch employees from your Employee model with relations
    useEffect(() => {
        const fetchHistory = async () => {
            try {
                // Fetch all data concurrently
                const [historydata] = await Promise.all([

                    client.models.History.getHistoryByEntityId({
                        entityId: customerSiteId,
                    }, {
                        sortDirection: 'DESC',
                        limit: 20
                    })
                ]);


                // Convert to string format
                const historyString = historydata.data
                    .map(entry => entry.details)
                    .join('');
                setHistory(historyString);




            } catch (error) {
                console.error("Error fetching site:", error);
            } finally {
                setLoading(false)
            }
        };


        fetchHistory();

    }, [customerSiteId]);




    return (
        <Card className="bg-background border-slate-200 shadow-sm">
            <CardHeader className="bg-background border-b border-slate-200">
                <CardTitle className="flex items-center gap-2 text-foreground">
                    <FileText className="h-5 w-5" />
                    History & Notes
                </CardTitle>
                <CardDescription>
                    CRM history and additional notes
                </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
                <div className="space-y-4">
                    {loading ? <Loading /> : (
                        <div>
                            <Label htmlFor="history" className="text-sm font-medium text-slate-700">
                                CRM History
                            </Label>
                            <Textarea
                                id="history"
                                value={history || ''}
                                className="min-h-[200px] text-sm resize-vertical border-slate-300 focus:border-blue-500"
                                placeholder="Add any relevant history or notes about the employee..."
                                readOnly
                            />
                            <p className="text-xs text-slate-500 mt-1">
                                This field will automatically record creation and updates.
                            </p>
                        </div>
                    )}
                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                        <p className="text-sm text-blue-800">
                            <strong>Note:</strong> System-generated history entries will be automatically
                            added when creating or updating this crm record.
                        </p>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}