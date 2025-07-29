import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Building2, Users, Receipt, DollarSign, Plus, LogOut } from 'lucide-react';
import { CreateApartmentDialog } from '@/components/CreateApartmentDialog';
import { JoinApartmentDialog } from '@/components/JoinApartmentDialog';
import { useToast } from '@/hooks/use-toast';

interface Apartment {
  id: string;
  name: string;
  code: string;
  created_at: string;
  member_count: number;
  total_expenses: number;
  user_balance: number;
}

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showJoinDialog, setShowJoinDialog] = useState(false);

  useEffect(() => {
    if (user) {
      fetchApartments();
    }
  }, [user]);

  const fetchApartments = async () => {
    try {
      // Get apartments the user is a member of with additional data
      const { data, error } = await supabase
        .from('apartment_members')
        .select(`
          apartment_id,
          apartments!inner (
            id,
            name,
            code,
            created_at
          )
        `)
        .eq('user_id', user?.id);

      if (error) throw error;

      // Get member counts and expense totals for each apartment
      const apartmentData = await Promise.all(
        data.map(async (item) => {
          const apartmentId = item.apartments.id;
          
          // Get member count
          const { count: memberCount } = await supabase
            .from('apartment_members')
            .select('*', { count: 'exact' })
            .eq('apartment_id', apartmentId);

          // Get total expenses
          const { data: expenses } = await supabase
            .from('expenses')
            .select('amount')
            .eq('apartment_id', apartmentId);

          const totalExpenses = expenses?.reduce((sum, exp) => sum + Number(exp.amount), 0) || 0;

          // Calculate user balance (simplified - should be more complex in real app)
          const userBalance = 0; // TODO: Calculate actual balance

          return {
            id: apartmentId,
            name: item.apartments.name,
            code: item.apartments.code,
            created_at: item.apartments.created_at,
            member_count: memberCount || 0,
            total_expenses: totalExpenses,
            user_balance: userBalance
          };
        })
      );

      setApartments(apartmentData);
    } catch (error) {
      console.error('Error fetching apartments:', error);
      toast({
        title: "Error",
        description: "Failed to load apartments",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApartmentCreated = () => {
    setShowCreateDialog(false);
    fetchApartments();
  };

  const handleApartmentJoined = () => {
    setShowJoinDialog(false);
    fetchApartments();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Building2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading your apartments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Building2 className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-semibold">Apartment Splitter</h1>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-muted-foreground">
              Welcome, {user?.user_metadata?.full_name || user?.email}
            </span>
            <Button variant="outline" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <Button onClick={() => setShowCreateDialog(true)} className="flex-1 sm:flex-none">
            <Plus className="h-4 w-4 mr-2" />
            Create Apartment
          </Button>
          <Button variant="outline" onClick={() => setShowJoinDialog(true)} className="flex-1 sm:flex-none">
            <Users className="h-4 w-4 mr-2" />
            Join Apartment
          </Button>
        </div>

        {/* Apartments Grid */}
        {apartments.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Apartments Yet</h3>
              <p className="text-muted-foreground text-center mb-6">
                Create your first apartment or join an existing one to start splitting expenses
              </p>
              <div className="flex gap-2">
                <Button onClick={() => setShowCreateDialog(true)}>
                  Create Apartment
                </Button>
                <Button variant="outline" onClick={() => setShowJoinDialog(true)}>
                  Join Apartment
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {apartments.map((apartment) => (
              <Card key={apartment.id} className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{apartment.name}</CardTitle>
                    <Badge variant="secondary">{apartment.code}</Badge>
                  </div>
                  <CardDescription>
                    Created {new Date(apartment.created_at).toLocaleDateString()}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{apartment.member_count} members</span>
                      </div>
                    </div>
                    
                    <Separator />
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Receipt className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">Total Expenses</span>
                        </div>
                        <span className="font-medium">${apartment.total_expenses.toFixed(2)}</span>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">Your Balance</span>
                        </div>
                        <span className={`font-medium ${apartment.user_balance < 0 ? 'text-destructive' : apartment.user_balance > 0 ? 'text-green-600' : ''}`}>
                          ${apartment.user_balance.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Dialogs */}
      <CreateApartmentDialog 
        open={showCreateDialog} 
        onOpenChange={setShowCreateDialog}
        onSuccess={handleApartmentCreated}
      />
      <JoinApartmentDialog 
        open={showJoinDialog} 
        onOpenChange={setShowJoinDialog}
        onSuccess={handleApartmentJoined}
      />
    </div>
  );
}