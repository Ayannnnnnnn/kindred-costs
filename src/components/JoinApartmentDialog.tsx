import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface JoinApartmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function JoinApartmentDialog({ open, onOpenChange, onSuccess }: JoinApartmentDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [apartmentCode, setApartmentCode] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !apartmentCode.trim()) return;

    setLoading(true);
    try {
      // Find apartment by code
      const { data: apartment, error: apartmentError } = await supabase
        .from('apartments')
        .select('id, name')
        .eq('code', apartmentCode.trim().toUpperCase())
        .single();

      if (apartmentError) {
        throw new Error('Apartment not found. Please check the code and try again.');
      }

      // Check if already a member
      const { data: existingMember } = await supabase
        .from('apartment_members')
        .select('id')
        .eq('apartment_id', apartment.id)
        .eq('user_id', user.id)
        .single();

      if (existingMember) {
        throw new Error('You are already a member of this apartment.');
      }

      // Add user as member
      const { error: memberError } = await supabase
        .from('apartment_members')
        .insert({
          apartment_id: apartment.id,
          user_id: user.id
        });

      if (memberError) throw memberError;

      toast({
        title: "Joined Apartment!",
        description: `You have successfully joined ${apartment.name}`
      });

      setApartmentCode('');
      onSuccess();
    } catch (error: any) {
      console.error('Error joining apartment:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to join apartment",
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
          <DialogTitle>Join Apartment</DialogTitle>
          <DialogDescription>
            Enter the apartment code shared by your roommate to join their expense group.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="apartment-code">Apartment Code</Label>
            <Input
              id="apartment-code"
              placeholder="e.g., AB12C3"
              value={apartmentCode}
              onChange={(e) => setApartmentCode(e.target.value.toUpperCase())}
              required
              maxLength={6}
              className="uppercase"
            />
            <p className="text-xs text-muted-foreground">
              Ask your roommate for the 6-character apartment code
            </p>
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
            <Button type="submit" disabled={loading || !apartmentCode.trim()}>
              {loading ? "Joining..." : "Join Apartment"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}