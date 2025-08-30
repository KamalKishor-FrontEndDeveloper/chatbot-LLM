import { HealthcareTreatment } from '@shared/schema';
import { useState, useEffect } from 'react';
import { Users } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

interface TreatmentCardProps {
  treatment: HealthcareTreatment;
}

interface Doctor {
  id: number;
  name: string;
  specialization: string;
  is_available: boolean;
}

export default function TreatmentCard({ treatment }: TreatmentCardProps) {
  const [fetchedDoctorNames, setFetchedDoctorNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Helper function to get doctor IDs from comma-separated string or array
  const getDoctorIds = (treatment: HealthcareTreatment): number[] => {
    if (!treatment.doctors) return [];

    if (Array.isArray(treatment.doctors)) {
      // Ensure each item is treated as a potential ID (number or string that can be parsed)
      return treatment.doctors
        .map(d => typeof d === 'string' ? parseInt(d) : d)
        .filter(id => !isNaN(id));
    }

    // Handle comma-separated string
    if (typeof treatment.doctors === 'string') {
      return treatment.doctors
        .split(',')
        .map(id => parseInt(id.trim()))
        .filter(id => !isNaN(id));
    }

    return [];
  };

  // Helper function to get doctor count
  const getDoctorCount = (treatment: HealthcareTreatment): number => {
    return getDoctorIds(treatment).length;
  };

  const doctorCount = getDoctorCount(treatment);
  const treatmentDoctorIds = getDoctorIds(treatment);

  const { data: doctors } = useQuery({
    queryKey: ['doctors'],
    queryFn: async () => {
      const response = await fetch('/api/doctors');
      if (!response.ok) throw new Error('Failed to fetch doctors');
      const result = await response.json();
      return result.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const availableDoctors = doctors?.filter((doctor: any) => 
    treatmentDoctorIds.includes(doctor.id)
  ) || [];

  useEffect(() => {
    const fetchDoctorNames = async () => {
      const doctorIds = getDoctorIds(treatment); // Use the unified getDoctorIds function
      if (doctorIds.length === 0) {
        setFetchedDoctorNames([]); // Ensure names are cleared if no doctors
        return;
      }

      setLoading(true);
      try {
        const response = await fetch('/api/doctors');
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            const allDoctors: Doctor[] = result.data;
            const relevantDoctors = allDoctors.filter(doctor => 
              doctorIds.includes(doctor.id)
            );
            const names = relevantDoctors.map(doctor => 
              doctor.name.replace(/^Dr\.\s*/, 'Dr. ')
            );
            setFetchedDoctorNames(names);
          } else {
             setFetchedDoctorNames([]); // Clear names if API returns no data or error
          }
        } else {
            console.error('Failed to fetch doctors:', response.statusText);
            setFetchedDoctorNames([]); // Clear names on fetch error
        }
      } catch (error) {
        console.error('Error fetching doctor names:', error);
        setFetchedDoctorNames([]); // Clear names on network error
      } finally {
        setLoading(false);
      }
    };

    fetchDoctorNames();
  }, [treatment.doctors]); // Dependency on treatment.doctors to refetch if it changes

  const isCondition = treatment.name.includes('(C)');
  const isTreatment = treatment.name.includes('(T)');

  const categoryType = isCondition ? 'Condition' : isTreatment ? 'Treatment' : 'Service';
  const categoryColor = isCondition ? 'bg-accent/10 text-accent' : 'bg-secondary/10 text-secondary';

  const hasPrice = treatment.price && treatment.price !== '';

  return (
    <div 
      className="treatment-card bg-muted/30 border border-border rounded-lg p-4 transition-all duration-200 hover:shadow-md hover:-translate-y-1"
      data-testid={`treatment-card-${treatment.id}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-2">
            <h4 className="font-semibold text-foreground">{treatment.t_name}</h4>
            <span className={`text-xs px-2 py-1 rounded-full ${categoryColor}`}>
              {categoryType}
            </span>
          </div>

          {treatment.name !== treatment.t_name && (
            <p className="text-sm text-muted-foreground mb-3">{treatment.name.replace(/\s*\([CT]\)$/, '')}</p>
          )}

          <div className="flex items-center space-x-4 text-sm">
            {doctorCount > 0 && (
              <div className="flex items-center space-x-1">
                <i className="fas fa-user-md text-primary text-xs"></i>
                <span className="text-muted-foreground">
                  {doctorCount} Doctor{doctorCount !== 1 ? 's' : ''} Available
                </span>
              </div>
            )}

            <div className="flex items-center space-x-1">
              <i className="fas fa-info-circle text-accent text-xs"></i>
              <span className="text-muted-foreground">ID: {treatment.id}</span>
            </div>
          </div>

          {doctorCount > 0 && (
            <div className="mt-2">
              <div className="text-xs text-muted-foreground mb-1">Available Doctors:</div>
              {loading ? (
                <div className="text-xs text-muted-foreground">Loading doctors...</div>
              ) : fetchedDoctorNames.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {fetchedDoctorNames.map((name, index) => (
                    <span 
                      key={index}
                      className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full"
                    >
                      {name}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">
                  {treatmentDoctorIds.length > 0 ? `Doctor IDs: ${treatmentDoctorIds.join(', ')}` : 'No doctors available'}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="text-right ml-4">
          <p className="text-sm text-muted-foreground">Price</p>
          {hasPrice ? (
            <p className="text-lg font-bold text-primary">₹{treatment.price}</p>
          ) : (
            <p className="text-sm font-medium text-muted-foreground">Contact for Quote</p>
          )}
        </div>
      </div>
    </div>
  );
}