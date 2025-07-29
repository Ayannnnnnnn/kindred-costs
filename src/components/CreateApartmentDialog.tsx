import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CreateApartmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CreateApartmentDialog({ open, onOpenChange, onSuccess }: CreateApartmentDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [apartmentName, setApartmentName] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !apartmentName.trim()) return;

    setLoading(true);
    try {
      // Generate apartment code
      const { data: codeData, error: codeError } = await supabase
        .rpc('generate_apartment_code');

      if (codeError) throw codeError;

      // Create apartment
      const { data: apartment, error: apartmentError } = await supabase
        .from('apartments')
        .insert({
          name: apartmentName.trim(),
          code: codeData,
          created_by: user.id
        })
        .select()
        .single();

      if (apartmentError) throw apartmentError;

      // Add creator as member
      const { error: memberError } = await supabase
        .from('apartment_members')
        .insert({
          apartment_id: apartment.id,
          user_id: user.id
        });

      if (memberError) throw memberError;

      toast({
        title: "Apartment Created!",
        description: `${apartmentName} has been created with code: ${codeData}`
      });

      setApartmentName('');
      onSuccess();
    } catch (error: any) {
      console.error('Error creating apartment:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create apartment",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Apartment</DialogTitle>
          <DialogDescription>
            Create a new apartment group to start splitting expenses with your roommates.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="apartment-name">Apartment Name</Label>
            <Input
              id="apartment-name"
              placeholder="e.g., Downtown Apartment, Shared House..."
              value={apartmentName}
              onChange={(e) => setApartmentName(e.target.value)}
              required
            />
          </div>
          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !apartmentName.trim()}>
              {loading ? "Creating..." : "Create Apartment"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}