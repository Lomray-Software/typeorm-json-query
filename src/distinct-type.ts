enum DistinctType {
  DISABLED = 'disabled',
  POSTGRES = 'postgres', // Apply postgres distinct on
  ALL = 'all', // Apply any RDB distinct
}

export default DistinctType;
