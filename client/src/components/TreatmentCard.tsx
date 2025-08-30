import { HealthcareTreatment } from '@shared/schema';
import { useState, useEffect } from 'react';

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
  const [doctorNames, setDoctorNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const getDoctorCount = (doctors: string): number => {
    if (!doctors) return 0;
    try {
      const doctorIds = JSON.parse(doctors);
      return Array.isArray(doctorIds) ? doctorIds.length : 0;
    } catch {
      return 0;
    }
  };

  const getDoctorIds = (doctors: string): number[] => {
    if (!doctors) return [];
    try {
      const doctorIds = JSON.parse(doctors);
      return Array.isArray(doctorIds) ? doctorIds : [];
    } catch {
      return [];
    }
  };

  useEffect(() => {
    const fetchDoctorNames = async () => {
      const doctorIds = getDoctorIds(treatment.doctors);
      if (doctorIds.length === 0) return;

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
            setDoctorNames(names);
          }
        }
      } catch (error) {
        console.error('Error fetching doctor names:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDoctorNames();
  }, [treatment.doctors]);

  const isCondition = treatment.name.includes('(C)');
  const isTreatment = treatment.name.includes('(T)');
  
  const categoryType = isCondition ? 'Condition' : isTreatment ? 'Treatment' : 'Service';
  const categoryColor = isCondition ? 'bg-accent/10 text-accent' : 'bg-secondary/10 text-secondary';

  const doctorCount = getDoctorCount(treatment.doctors);
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
              ) : doctorNames.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {doctorNames.map((name, index) => (
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
                  No doctors available
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
