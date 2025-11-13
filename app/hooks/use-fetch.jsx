import { useState } from "react";
import { toast } from "sonner";

const useFetch = (cb) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fn = async (...args) => {
        setLoading(true);
        setError(null);
        try {
            const response = await cb(...args);
            // Normalize unexpected empty responses into a consistent error-shaped object
            let outcome = response;
            if (!response || typeof response !== 'object' || (Object.keys(response).length === 0 && response.constructor === Object)) {
                outcome = { success: false, error: 'Empty server response' };
            }
            setData(outcome);
            setError(null);
            return outcome;
        } catch (error) {
            setError(error);
            toast.error(error.message || "An error occurred");
            throw error;
        } finally {
            setLoading(false);
        }
    };

    return { data, loading, error, fn, setData };
}

export default useFetch;