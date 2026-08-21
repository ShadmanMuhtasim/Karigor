import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

interface Category {
  id: number;
  name: string;
  iconUrl: string;
}

export function Categories() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await apiClient.get<{value: Category[]}>('/categories');
      return response.data.value || response.data; // Handle potential different response structures
    }
  });

  if (isLoading) return <div className="p-8">Loading categories...</div>;
  if (error) return <div className="p-8 text-red-500">Error loading categories</div>;

  const categories: Category[] = Array.isArray(data) ? data : [];

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Service Categories</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {categories.map((cat) => (
          <Card key={cat.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-4">
                <img src={cat.iconUrl} alt={cat.name} className="w-8 h-8" />
                {cat.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Find a professional {cat.name}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
