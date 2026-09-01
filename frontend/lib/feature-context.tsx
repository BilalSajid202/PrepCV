"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "./auth-context";
import { fetchMyFeatures } from "./api";

interface FeatureContextType {
  features: string[];
  loading: boolean;
  hasFeature: (featureKey: string) => boolean;
  refreshFeatures: () => Promise<void>;
}

const FeatureContext = createContext<FeatureContextType | undefined>(undefined);

export function FeatureProvider({ children }: { children: React.ReactNode }) {
  const { user, isAdmin } = useAuth();
  const [features, setFeatures] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const loadFeatures = async () => {
    if (!user) {
      setFeatures([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const userFeatures = await fetchMyFeatures();
      setFeatures(userFeatures);
    } catch {
      // If endpoint fails or user has none, fallback to empty
      setFeatures([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFeatures();
  }, [user]);

  const hasFeature = (featureKey: string): boolean => {
    if (isAdmin) return true; // Admins always have access to all features
    return features.includes(featureKey);
  };

  return (
    <FeatureContext.Provider
      value={{
        features,
        loading,
        hasFeature,
        refreshFeatures: loadFeatures,
      }}
    >
      {children}
    </FeatureContext.Provider>
  );
}

export function useFeatures() {
  const context = useContext(FeatureContext);
  if (!context) {
    throw new Error("useFeatures must be used within a FeatureProvider");
  }
  return context;
}
